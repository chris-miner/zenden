const { ApiError, Client, Environment } = require('square')
const { Command } = require('commander');

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
    retries: 3,
    timeout: 3000,
    environment: Environment.Production,
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
})

const program = new Command()
program.version('0.0.1')

program
    .command('bookings <year> <month>')
    .description('list bookings for the given month')
    .action(listBookings)


program
    .command('locations')
    .description('list locations for business')
    .action(listLocations)

program
    .command('customer <customer_id>')
    .description('retrieve the customer for the given id')
    .action((customerId: string) => {
        retrieveCustomer(customerId).then((customer) => {
            console.log(customer)
        })
    })

program
    .command('nt')
    .description('retrieve nail trim customers')
    .action(listNailTrim)

program
    .command('staff <firstName> <lastName>')
    .description('Looks up staff member info')
    .action((firstName: string, lastName: string) => {
        listTeamMembers(firstName, lastName)
            .then((teamMembers) => {
                console.log(JSON.stringify(teamMembers))
            })
    })

program.parse(process.argv);

async function listNailTrim() {
    var cursor = ""
    var customers: any[] = []
    while (cursor !== null) {
        try {
            let { result } = await client.customersApi.listCustomers(cursor, 100, 'CREATED_AT', 'ASC');

            customers = customers.concat(result.customers);
            cursor = result.cursor ? result.cursor : null;

        } catch (error) {
            if (error instanceof ApiError) {
                console.log(`API Error: ${error}`)
            } else {
                console.log(`Unexpected Error: ${error}`)
            }
        }
    }

    for (const customer of customers) {
        const orders = retrieveOrders(customer.id)
        console.log(`"${orders.length}", "${customer.givenName} ${customer.familyName}", "${customer.emailAddress}", "${customer.phoneNumber}"`)
    }
}
// FIXME: implement this to retrieve orders for a customer
function retrieveOrders(id: string) {
    return []
}

async function listBookings(year: number, month: string) {
    const monthIndex = new Date(month + " 1").getMonth()
    const startTime = new Date(year, monthIndex, 1)
    const endTime = new Date(year, monthIndex + 1, 0)

    var cursor: string = ""
    while (cursor !== null) {
        try {
            const { result } = await client.bookingsApi.listBookings(100, cursor, "", "6JP61784A3D6V", startTime.toISOString(), endTime.toISOString());
            cursor = result.cursor ? result.cursor : null;
            const bookings = result.bookings;
            for (const booking of bookings) {
                if (booking.status === "ACCEPTED" || booking.status === "PENDING") {
                    try {
                        const customer = await retrieveCustomer(booking.customerId)
                        const staff = await retrieveStaff(booking.appointmentSegments[0].teamMemberId)
                        if (customer != null) {
                            const startAt = new Date(booking.startAt)

                            console.log(`"${startAt.toLocaleString()}", "${staff.givenName}", "${booking.status}", "${customer.givenName} ${customer.familyName}", "${customer.emailAddress}", "${customer.phoneNumber}"`)
                        }
                        else {
                            console.error(`No customer found for booking ${booking.id} with customerId ${booking.customerId}`)
                        }
                    }
                    catch (error) {
                        console.error(error)
                    }
                }
            }

        } catch (error) {
            if (error instanceof ApiError) {
                console.error(`API Error: ${error}`)
            } else {
                console.error(`Unexpected Error: ${error}`)
            }
            // exit loop on error
            break;
        }
    }
}

async function listTeamMembers(firstName: string, lastName: string) {
    try {
        const { result } = await client.teamApi.searchTeamMembers({});
        let members = result.teamMembers.filter((value: any) => {
            if (value.givenName === firstName && value.familyName === lastName)
                return value
        })

        return members
    } catch (error) {
        if (error instanceof ApiError) {
            console.error(`API Error: ${error}`)
        } else {
            console.error(`Unexpected Error: ${error}`)
        }
    }
}

async function retrieveStaff(id: string) {
    try {
        const { result } = await client.teamApi.retrieveTeamMember(id);
        return result.teamMember
    } catch (error) {
        if (error instanceof ApiError) {
            console.error(`API Error: ${error} for staff ${id}`)
        } else {
            console.error(`Unexpected Error: ${error}`)
        }
    }
}

async function retrieveCustomer(id: string) {
    try {
        const { result } = await client.customersApi.retrieveCustomer(id);

        return result.customer;
    } catch (error: any) {
        if (error instanceof ApiError) {
            const firstError = error.errors[0];
            if (firstError.code !== "NOT_FOUND")
                console.error("There was an error in your request: ", error.errors)
        } else {
            console.error("Unexpected Error: ", error)
        }
    }
}


async function listLocations() {
    // The try/catch statement needs to be called from within an asynchronous function
    try {
        // Call listLocations method to get all locations in this Square account
        let listLocationsResponse = await client.locationsApi.listLocations()

        // Get first location from list
        let firstLocation = listLocationsResponse.result.locations[0]

        console.log("Here is your first location: ", firstLocation)
    } catch (error: any) {
        if (error instanceof ApiError) {
            console.error("There was an error in your request: ", error.errors)
        } else {
            console.error("Unexpected Error: ", error)
        }
    }
}