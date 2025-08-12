#!/usr/bin/env node

function validateOwnerName(name) {
    console.log('Testing name:', name);
    console.log('Type:', typeof name);
    
    if (!name || typeof name !== 'string') {
        console.log('Failed: not a string or empty');
        return false;
    }
    
    console.log('Length:', name.length);
    // Check length - minimum 2 characters, maximum 39
    if (name.length < 2 || name.length > 39) {
        console.log('Failed: length check');
        return false;
    }
    
    // Cannot start or end with a hyphen
    if (name.startsWith('-') || name.endsWith('-')) {
        console.log('Failed: starts/ends with hyphen');
        return false;
    }
    
    // Cannot contain consecutive hyphens
    if (name.includes('--')) {
        console.log('Failed: consecutive hyphens');
        return false;
    }
    
    // Only allow alphanumeric and hyphen
    const validPattern = /^[a-zA-Z0-9-]+$/;
    const result = validPattern.test(name);
    console.log('Pattern test result:', result);
    return result;
}

// Test cases
console.log('Testing "quanticsoul4772":');
console.log('Result:', validateOwnerName('quanticsoul4772'));
console.log('\nTesting "facebook":');
console.log('Result:', validateOwnerName('facebook'));
console.log('\nTesting undefined:');
console.log('Result:', validateOwnerName(undefined));
console.log('\nTesting empty string:');
console.log('Result:', validateOwnerName(''));
