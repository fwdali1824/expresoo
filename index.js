/**
 * A simple greeting function.
 * @param {string} name - The name to greet.
 * @returns {string} - A greeting message.
 */
function greet(name) {
    if (!name) {
        return "Hello, World!";
    }
    return `Hello, ${name}! Welcome to the KHN package.`;
}

/**
 * Adds two numbers.
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
function add(a, b) {
    return a + b;
}

module.exports = {
    greet,
    add
};
