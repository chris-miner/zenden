"use strict";
const { ApiError, Client, Environment } = require('square')
const { Command } = require('commander');

const program = new Command()

program.version('0.0.1')

program
    .command('bookings <year> <month>')
    .description('list bookings for the given month')
    .action(listBookings)

program
    .command('move <appointment_id> <to_staff_id>')
    .description('move the booking to new staff member')
    .action((appointmentId, staffId) => {
        moveBooking(appointmentId, staffId).then((booking) => {
            console.log(booking)
        })
    })

program
    .command('locations')
    .description('list locations for business')
    .action(listLocations)

program
    .command('customer <customer_id>')
    .description('retrieve the customer for the given id')
    .action((customerId) => {
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
    .action((firstName, lastName) => {
        listTeamMembers(firstName, lastName).then((teamMembers) => {
            console.log(JSON.stringify(teamMembers))
        })
    })

program.parse(process.argv);

function moveBooking(bookingId, staffId) {
    const squareApi = async () => {
        const client = new Client({
            timeout: 3000,
            environment: Environment.Production,
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
        });

        try {
            const response = await client.bookingsApi.retrieveBooking(bookingId);

            console.log(response.result);
        } catch (error) {
            console.log(error);
        }
    }
    return squareApi()
}

function listNailTrim() {
    const getNailTrim = async () => {
        const client = new Client({
            timeout: 3000,
            environment: Environment.Production,
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
        });
        const { customersApi } = client;

        var cursor = ""
        var customers = []
        while (cursor !== null) {
            try {
                let { result } = await customersApi.listCustomers(cursor, 100, 'CREATED_AT', 'ASC');

                customers = customers.concat(result.customers);
                cursor = result.cursor ? result.cursor : null;

            } catch (error) {
                if (error instanceof ApiError) {
                    console.log(`Errors: ${error}`)
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
    getNailTrim()
}
// FIXME: implement this to retrieve orders for a customer
function retrieveOrders(id) {
    return []
}

function listBookings(year, month) {
    const getBookings = async () => {
        const client = new Client({
            timeout: 3000,
            environment: Environment.Production,
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
        });
        const { bookingsApi } = client

        const monthIndex = new Date(month + " 1").getMonth()
        const startTime = new Date(year, monthIndex, 1)
        const endTime = new Date(year, monthIndex + 1, 0)

        var cursor = ""
        var bookings = []
        // Count the total number of customers using the listCustomers method
        while (cursor !== null) {

            try {
                let { result } = await bookingsApi.listBookings(100, cursor, "", "6JP61784A3D6V", startTime.toISOString(), endTime.toISOString());
                bookings = bookings.concat(result.bookings);
                cursor = result.cursor ? result.cursor : null;
            } catch (error) {
                if (error instanceof ApiError) {
                    console.log(`Errors: ${error}`)
                } else {
                    console.log(`Unexpected Error: ${error}`)
                }
                // 
                break
            }
        }

        for (const booking of bookings) {
            try {
                const customer = await retrieveCustomer(booking.customerId)
                console.log(`"${booking.startAt}", "${customer.givenName} ${customer.familyName}", "${customer.emailAddress}", "${customer.phoneNumber}"`)
            }
            catch (error) {
                console.log(error)
            }
        }
    }
    getBookings()
}

function listTeamMembers(firstName, lastName) {
    const getStaff = async () => {
        const client = new Client({
            timeout: 3000,
            environment: Environment.Production,
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
        })

        try {
            const { result } = await client.teamApi.searchTeamMembers({});
            let members = result.teamMembers.filter((value) => {
                if (value.givenName === firstName && value.familyName === lastName)
                    return value
            })

            return members
        } catch (error) {
            if (error instanceof ApiError) {
                console.log(`Errors: ${error}`)
            } else {
                console.log(`Unexpected Error: ${error}`)
            }
        }
    }
    return getStaff()
}

function retrieveCustomer(id) {
    const getCustomer = async () => {
        const client = new Client({
            timeout: 3000,
            environment: Environment.Production,
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
        })

        const { customersApi } = client

        try {
            const { result } = await customersApi.retrieveCustomer(id);
            return result.customer
        } catch (error) {
            if (error instanceof ApiError) {
                console.log(`Errors: ${error}`)
            } else {
                console.log(`Unexpected Error: ${error}`)
            }
        }
    }
    return getCustomer()
}

function listLocations() {
    // Create an instance of the API Client 
    // and initialize it with the credentials 
    // for the Square account whose assets you want to manage
    const client = new Client({
        timeout: 3000,
        environment: Environment.Production,
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
    })

    // Get an instance of the Square API you want call
    const { locationsApi } = client

    // Create wrapper async function 
    const getLocations = async () => {
        // The try/catch statement needs to be called from within an asynchronous function
        try {
            // Call listLocations method to get all locations in this Square account
            let listLocationsResponse = await locationsApi.listLocations()

            // Get first location from list
            let firstLocation = listLocationsResponse.result.locations[0]

            console.log("Here is your first location: ", firstLocation)
        } catch (error) {
            if (error instanceof ApiError) {
                console.log("There was an error in your request: ", error.errors)
            } else {
                console.log("Unexpected Error: ", error)
            }
        }
    }
    // Invokes the async function
    getLocations()
}