const { io } = require('socket.io-client');

const testSocket = async () => {
    console.log('--- Socket.io Broadcast Test ---');
    const customer = io('http://localhost:5001');
    const driver = io('http://localhost:5001');

    let received = false;

    driver.on('connect', () => {
        console.log('Driver connected');
        // No need to join for broadcast, but good practice
        driver.emit('join', 'driver_test_id');
    });

    driver.on('incoming-ride', (data) => {
        console.log('✅ Driver received incoming-ride:', data.rideId);
        received = true;
    });

    customer.on('connect', () => {
        console.log('Customer connected');
        setTimeout(() => {
            console.log('Customer emitting request-ride...');
            customer.emit('request-ride', {
                rideId: 'test_ride_123',
                pickup: { address: 'Test Origin' },
                drop: { address: 'Test Destination' },
                fare: '₹100',
                customerId: 'customer_test_id',
                customerName: 'Test User'
                // NO scheduledTime
            });
        }, 1000);
    });

    setTimeout(() => {
        if (received) {
            console.log('SUCCESS: Broadcast works.');
        } else {
            console.log('FAILURE: Driver did not receive notification.');
        }
        customer.disconnect();
        driver.disconnect();
        process.exit(received ? 0 : 1);
    }, 5000);
};

testSocket();
