import { ApiError, BookingsApi, Client, Customer, Environment, ListBookingsResponse, ListCustomersResponse, ListLocationsResponse, Location, RetrieveCustomerResponse, SearchCustomersResponse, TeamMember } from 'square';
import { program } from 'commander';
import 'dotenv/config'

const client = new Client({
    // retryConfig: customRetryConfiguration,
    httpClientOptions: {
        retryConfig: {
            maxNumberOfRetries: 3,
            retryOnTimeout: true,
            retryInterval: 1,
            maximumRetryWaitTime: 0,
            backoffFactor: 2,
            httpStatusCodesToRetry: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
            httpMethodsToRetry: ['GET', 'PUT'],
        }
    },
    timeout: 6000,
    environment: process.env.SQUARE_ENVIRONMENT as Environment,
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
})

program.version('0.0.2').description("CLI utility for maninuplating Square Data.")

program
    .command('bookings <year> <month>')
    .description('List bookings')
    .action((year: number, month: string) => listBookings(year, month))


program
    .command('locations')
    .description('list locations for business')
    .action(listLocations)

program
    .command('staff <firstName> <lastName>')
    .description('Looks up staff member info')
    .action((firstName: string, lastName: string) => {
        listTeamMembers(firstName, lastName)
            .then((teamMembers) => {
                console.log(JSON.stringify(teamMembers))
            })
    })

program
    .command('customer')
    .argument('<email>')
    .option('-d, --debug', 'Print debug messages')
    .description('retrieve the customer for the given email')
    .action((email: string, options: any, command: any) => { searchCustomer(email, options, command) })

program.parse(process.argv);

async function searchCustomer(email: string, options: any, command: any): Promise<void> {
    if (options.debug)
        console.log(`Searching for customer with email ${email}`)

    const body = {
        query: {
            filter: {
                emailAddress: {
                    exact: email
                }
            }
        }
    }

    client.customersApi.searchCustomers(body)
        .then((response) => response.result)
        .then((result: SearchCustomersResponse) => {
            if (result.errors || result.customers == null) {
                if (options.debug)
                    console.log(`No customer found for email ${email}`)
                return;
            }
            return result.customers;
        })
        .then((customers) => {
            if (customers == null || customers.length === 0) {
                if (options.debug)
                    console.log(`No customer found for email ${email}`)
                return;
            }

            if (customers.length > 1) {
                console.log(`Found more than one customer with email ${email}`)
            }

            return customers[0];
        })
        .then((customer) => {
            if (customer == null)
                return;

            console.log(`Found customer ${customer.givenName} ${customer.familyName} with email ${customer.emailAddress}`)
            return customer;
        })
        .then((customer) => {
            if (customer == null)
                return;

            const now = new Date();
            const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            client.bookingsApi.listBookings(10000, undefined, undefined, undefined, startAt.toISOString())
                .then((response) => response.result)
                .then((result: ListBookingsResponse) => {
                    if (result.errors && result.errors.length > 0) {
                        console.log(result.errors)
                        return;
                    }
                    return result.bookings
                })
                .then((bookings) => {
                    if (bookings == null || bookings.length === 0)
                        return;

                    return bookings.filter(booking => booking.customerId === customer.id)
                })
                .then((bookings) => {
                    if (bookings == null || bookings.length === 0) {
                        console.log(`No bookings found for customer ${customer.givenName} ${customer.familyName}`)
                        return;
                    }

                    console.log(`Bookings found for customer ${customer.givenName} ${customer.familyName}`)
                    bookings.map(booking => {
                        if (booking != null && booking.startAt != null) {
                            const startAt = new Date(booking.startAt)
                            console.log(`Booking on ${startAt.toLocaleString()} with status ${booking.status}`)
                        } else {
                            console.log(`Booking has no start date`)
                        }
                    })
                    bookings
                        .filter(booking => (booking.status === 'ACCEPTED' || booking.status === 'PENDING'))
                        .map(booking => {
                            const startAt = new Date(booking.startAt as string)
                            const red = '\x1b[31m'
                            const reset = '\x1b[0m'
                            console.log(`${red}Need to cancel booking on ${startAt.toLocaleString()} for ${customer.givenName} ${customer.familyName}${reset}`)
                        })
                }).catch(error => console.error(error))
        })
        .catch(error => console.error(error))
}

async function listBookings(year: number, month: string) {
    const monthIndex = new Date(month + " 1").getMonth()
    const startTime = new Date(year, monthIndex, 1)
    const endTime = new Date(year, monthIndex + 1, 0)

    var cursor: string | undefined = ""
    while (cursor != null) {
        try {
            const { result }: { result: ListBookingsResponse }
                = await client.bookingsApi.listBookings(10000, cursor, undefined, undefined, startTime.toISOString(), endTime.toISOString());
            if (result.bookings == null) break;
            cursor = result.cursor

            for (const booking of result.bookings) {
                if (booking.appointmentSegments != null
                    && booking.customerId != null
                    && (booking.status === "ACCEPTED" || booking.status === "PENDING")) {
                    try {
                        const customer = await retrieveCustomer(booking.customerId)
                        const staff = await retrieveTeamMember(booking.appointmentSegments[0].teamMemberId)

                        if (customer != null && staff != null && booking.startAt != null) {
                            const startAt = new Date(booking.startAt)
                            console.log(`"${startAt.toLocaleString()}", "${staff.givenName}", "${booking.status}", "${customer.givenName} ${customer.familyName}", "${customer.emailAddress}", "${customer.phoneNumber}"`)
                        }
                        else {
                            console.error(`No customer found for booking ${booking.id} with customerId ${booking.customerId} `)
                        }
                    }
                    catch (error) {
                        console.error(error)
                    }
                }
            }
        } catch (error) {
            if (error instanceof ApiError) {
                error.errors?.map(e => console.error(e))
            } else {
                console.error(`Unexpected Error: ${error} `)
            }
            // exit loop on error
            break;
        }
    }
}

async function listTeamMembers(firstName: string, lastName: string): Promise<TeamMember[] | undefined> {
    try {
        const { result } = await client.teamApi.searchTeamMembers({});
        if (result.teamMembers != null) {
            let members = result.teamMembers.filter((value: any) => {
                if (value.givenName === firstName && value.familyName === lastName)
                    return value
            })
            return members
        }

    } catch (error) {
        if (error instanceof ApiError) {
            console.error(`API Error: ${error} `)
        } else {
            console.error(`Unexpected Error: ${error} `)
        }
    }
}

async function retrieveTeamMember(id: string): Promise<TeamMember | undefined> {
    try {
        const { result } = await client.teamApi.retrieveTeamMember(id);
        return result.teamMember
    } catch (error) {
        if (error instanceof ApiError) {
            console.error(`API Error: ${error} for staff ${id}`)
        } else {
            console.error(`Unexpected Error: ${error} `)
        }
    }
}

async function retrieveCustomer(id: string): Promise<Customer | undefined> {
    try {
        const { result }: { result: RetrieveCustomerResponse } = await client.customersApi.retrieveCustomer(id);
        return result.customer;
    } catch (error) {
        if (error instanceof ApiError) {
            const firstError = error?.errors?.[0]
            if (firstError?.code !== "NOT_FOUND")
                console.error("There was an error in your request: ", error.errors)
        } else {
            console.error("Unexpected Error: ", error)
        }
    }
}


async function listLocations(): Promise<void> {
    try {
        // Call listLocations method to get all locations in this Square account
        const { result }: { result: ListLocationsResponse } = await client.locationsApi.listLocations()

        // Get first location from list
        if (result.locations != null) {
            const firstLocation = result.locations[0]
            console.log("Here is your first location: ", firstLocation)
        }
    } catch (error: any) {
        if (error instanceof ApiError) {
            console.error("There was an error in your request: ", error.errors)
        } else {
            console.error("Unexpected Error: ", error)
        }
    }
}