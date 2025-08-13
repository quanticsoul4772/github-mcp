#!/usr/bin/env node

// Test script to verify dotenv is working
import 'dotenv/config';

console.log('Testing dotenv configuration...');
console.log('GITHUB_PERSONAL_ACCESS_TOKEN:', process.env.GITHUB_PERSONAL_ACCESS_TOKEN ? 'LOADED (length: ' + process.env.GITHUB_PERSONAL_ACCESS_TOKEN.length + ')' : 'NOT FOUND');
console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');

// Test that we can access the environment variable
const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
if (token) {
  console.log('✅ GitHub token loaded successfully!');
  console.log('Token starts with:', token.substring(0, 10) + '...');
} else {
  console.log('❌ GitHub token not found in environment variables');
}
