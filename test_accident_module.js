// Test script for full Accident, Triage, and Multi-Ambulance Module

const fs = require('fs');
const html = fs.readFileSync('public/rvdp_fusion_bus_simulator.html', 'utf8');

console.log('Read HTML file, size:', html.length);
console.log('Testing accident module components...');

