import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStats,
  targetLevel,
  buildRestock,
} from '../src/services/insightEngine.js';

// Test 1: Dashboard statistics
test('calculates inventory statistics correctly', () => {
  const items = [
    {
      status: 'in_stock',
      quantity: 20,
      value: 200,
      retail: 300,
    },
    {
      status: 'low_stock',
      quantity: 3,
      value: 30,
      retail: 45,
    },
    {
      status: 'out_of_stock',
      quantity: 0,
      value: 0,
      retail: 0,
    },
  ];

  const result = computeStats(items);

  assert.equal(result.totalProducts, 3);
  assert.equal(result.totalUnits, 23);
  assert.equal(result.lowStock, 1);
  assert.equal(result.outOfStock, 1);
  assert.equal(result.inStock, 1);
  assert.equal(result.inventoryValue, 230);
});

// Test 2: Restock target calculation
test('calculates restock target using demand', () => {
  const product = {
    threshold: 5,
    dailyUse: 1,
  };

  const result = targetLevel(product);

  assert.equal(result, 30);
});

// Test 3: Restock target without demand
test('calculates target from threshold when demand is zero', () => {
  const product = {
    threshold: 5,
    dailyUse: 0,
  };

  const result = targetLevel(product);

  assert.equal(result, 10);
});

// Test 4: Restock recommendation
test('generates restock recommendation for low stock', () => {
  const items = [
    {
      name: 'Mouse',
      sku: 'M001',
      category: 'Electronics',
      supplier: 'Supplier A',
      quantity: 3,
      threshold: 5,
      status: 'low_stock',
      dailyUse: 0,
      daysOfCover: null,
      cost: 100,
    },
  ];

  const result = buildRestock(items);

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].suggestedReorderQty, 7);
  assert.equal(result.totals.units, 7);
  assert.equal(result.totals.estimatedCost, 700);
});

// Test 5: No restock when stock is healthy
test('does not recommend restocking healthy stock', () => {
  const items = [
    {
      name: 'Keyboard',
      sku: 'K001',
      category: 'Electronics',
      supplier: 'Supplier B',
      quantity: 50,
      threshold: 5,
      status: 'in_stock',
      dailyUse: 0,
      daysOfCover: null,
      cost: 500,
    },
  ];

  const result = buildRestock(items);

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.totals.units, 0);
});