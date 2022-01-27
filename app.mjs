import { ApiError, Client, Environment } from 'square'
import { Command } from 'commander/esm.mjs';

const program = new Command();
program.version('0.0.1')

program
    .command('bookings <year> <month>')
    .description('list bookings for the given month')
    .action(listBookings);

program
    .command('locations')
    .description('list locations for business')
    .action(listLocations);

program
    .command('customer <customer_id>')
    .description('retrieve the customer for the given id')
    .action(retrieveCustomer);

program.parse(process.argv);

function listBookings(year, month) {
    const getBookings = async () => {
        const client = new Client({
            timeout: 3000,
            environment: Environment.Production,
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
        });
        const { bookingsApi } = client;

        const monthIndex = new Date(month + " 1").getMonth();
        const startTime = new Date(year, monthIndex, 1);
        const endTime = new Date(year, monthIndex + 1, 0);

        var cursor = "";
        var bookings = [];
        // Count the total number of customers using the listCustomers method
        while (cursor !== null) {

            try {
                // Call listCustomers method to get all customers in this Square account
                let { result } = await bookingsApi.listBookings(100, cursor, "", "6JP61784A3D6V", startTime.toISOString(), endTime.toISOString());
                bookings = bookings.concat(result.bookings);
                // Get the cursor if it exists in the result else set it to null
                cursor = result.cursor ? result.cursor : null;

            } catch (error) {
                if (error instanceof ApiError) {
                    console.log(`Errors: ${error}`);
                } else {
                    console.log(`Unexpected Error: ${error}`);
                }
                // Exit loop once an error is encountered
                break;
            }
        }

        for (const booking of bookings) {
            const customer = await retrieveCustomer(booking.customerId)
            console.log(`"${booking.startAt}", "${customer.givenName} ${customer.familyName}", "${customer.emailAddress}", "${customer.phoneNumber}"`)
        }
    }
    getBookings()
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