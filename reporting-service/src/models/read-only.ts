import mongoose, { type Schema } from 'mongoose'

export class ReadOnlyViolationError extends Error {
  constructor(operation: string) {
    super(`Reporting Service is read-only: "${operation}" is not allowed`)
    this.name = 'ReadOnlyViolationError'
  }
}

const QUERY_WRITES = [
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'replaceOne',
] as const

/**
 * Rejects every mongoose write path on the models of this service.
 * Must be registered before any model is compiled (see models/index.ts).
 */
function readOnlyPlugin(schema: Schema): void {
  schema.pre('save', function () {
    throw new ReadOnlyViolationError('save')
  })
  schema.pre('deleteOne', { document: true, query: false }, function () {
    throw new ReadOnlyViolationError('deleteOne')
  })
  for (const operation of QUERY_WRITES) {
    schema.pre(operation, { document: false, query: true }, function () {
      throw new ReadOnlyViolationError(operation)
    })
  }
  schema.pre('insertMany', function () {
    throw new ReadOnlyViolationError('insertMany')
  })
  schema.pre('bulkWrite', function () {
    throw new ReadOnlyViolationError('bulkWrite')
  })
}

mongoose.plugin(readOnlyPlugin)
