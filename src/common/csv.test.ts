import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSV } from './csv'
import { parseLandData } from './data'

test('a trailing unquoted value is dropped, as graph-ts does', () => {
  assert.deepEqual(parseCSV('0,name'), ['0'])
  assert.deepEqual(parseCSV('0,name,'), ['0', 'name'])
})

test('quoted values end at the next quote and may be empty', () => {
  assert.deepEqual(parseCSV('0,"",""'), ['0', '', ''])
  assert.deepEqual(parseCSV('0,"a, b","desc"'), ['0', 'a, b', 'desc'])
})

test('consecutive commas emit nothing', () => {
  assert.deepEqual(parseCSV('0,,x,'), ['0', 'x'])
  assert.deepEqual(parseCSV(''), [])
})

test('only version 0 metadata is parsed', () => {
  assert.equal(parseLandData('1,"name"'), null)
  assert.equal(parseLandData(''), null)
  assert.equal(parseLandData('0'), null)
  assert.deepEqual(parseLandData('0,"Genesis Plaza","",""'), {
    version: '0',
    name: 'Genesis Plaza',
    description: '',
    ipns: '',
  })
})

test('fields absent from the CSV stay absent, so a merge keeps the old value', () => {
  assert.deepEqual(parseLandData('0,"only a name"'), { version: '0', name: 'only a name' })
})

test('NUL characters are stripped before they reach Postgres', () => {
  assert.deepEqual(parseLandData('0,"na\u0000me"'), { version: '0', name: 'name' })
})
