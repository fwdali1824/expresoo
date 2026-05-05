const khn = require('./index');

console.log('--- Testing KHN Package ---');

// Test greet
const greeting = khn.greet('Antigravity');
console.log('Test Greet:', greeting);

// Test add
const sum = khn.add(10, 20);
console.log('Test Add (10 + 20):', sum);

if (sum === 30 && greeting.includes('Antigravity')) {
    console.log('--- All tests passed! ---');
} else {
    console.log('--- Some tests failed. ---');
}
