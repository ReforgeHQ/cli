import {expect} from 'chai'

import {ZodToTypescriptMapper} from '../../../src/codegen/language-mappers/zod-to-typescript-mapper.js'
import {secureEvaluateSchema} from '../../../src/codegen/schema-evaluator.js'

describe('ZodToTypescriptMapper', () => {
  describe('renderField', () => {
    it('Can successfully parse strings', () => {
      const zodAst = secureEvaluateSchema(`z.string()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": string')
    })

    it('Can successfully parse numbers', () => {
      const zodAst = secureEvaluateSchema(`z.number()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": number')
    })

    it('Can successfully parse integer numbers', () => {
      const zodAst = secureEvaluateSchema(`z.number().int()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": number')
    })

    it('Can successfully parse booleans', () => {
      const zodAst = secureEvaluateSchema(`z.boolean()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": boolean')
    })

    it('Can successfully parse any', () => {
      const zodAst = secureEvaluateSchema(`z.any()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": any')
    })

    it('Can successfully parse an array wrapped type', () => {
      const zodAst = secureEvaluateSchema(`z.array(z.string())`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": Array<string>')
    })

    it('Can successfully parse an array chained type', () => {
      const zodAst = secureEvaluateSchema(`z.string().array()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": Array<string>')
    })

    it('Can successfully parse an enum', () => {
      const zodAst = secureEvaluateSchema(`z.enum(["first", "second"])`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal("\"someKey\": 'first' | 'second'")
    })

    it('Can successfully parse null', () => {
      const zodAst = secureEvaluateSchema(`z.null()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": null')
    })

    it('Can successfully parse undefined', () => {
      const zodAst = secureEvaluateSchema(`z.undefined()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": undefined')
    })

    it('Can successfully parse unknown', () => {
      const zodAst = secureEvaluateSchema(`z.unknown()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": unknown')
    })

    it('Can successfully parse unions', () => {
      const zodAst = secureEvaluateSchema(`z.union([z.string(), z.number()])`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": string | number')
    })

    it('Can successfully parse unions defined with or chaining', () => {
      const zodAst = secureEvaluateSchema(`z.string().or(z.number())`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": string | number')
    })

    it('Can successfully parse tuples', () => {
      const zodAst = secureEvaluateSchema(`z.tuple([z.string(), z.number()])`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey": [string, number]')
    })

    it('Can successfully parse objects', () => {
      const zodAst = secureEvaluateSchema(`z.object({ name: z.string(), age: z.number() })`)
      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})
      const rendered = mapper.renderField(zodAst.schema!)
      expect(rendered).to.equal('"someKey": { "name": string; "age": number }')
    })

    it('Can successfully parse records', () => {
      const zodAst = secureEvaluateSchema(`z.record(z.string(), z.number())`)
      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})
      const rendered = mapper.renderField(zodAst.schema!)
      expect(rendered).to.equal('"someKey": Record<string, number>')
    })

    it('Can successfully parse records with object values', () => {
      const zodAst = secureEvaluateSchema(`z.record(z.string(), z.object({ id: z.string(), count: z.number() }))`)
      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})
      const rendered = mapper.renderField(zodAst.schema!)
      expect(rendered).to.equal('"someKey": Record<string, { "id": string; "count": number }>')
    })

    it('Can successfully parse an optional wrapped type', () => {
      const zodAst = secureEvaluateSchema(`z.optional(z.string())`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey"?: string')
    })

    it('Can successfully parse an optional chained type', () => {
      const zodAst = secureEvaluateSchema(`z.string().optional()`)

      const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

      const rendered = mapper.renderField(zodAst.schema!)

      expect(rendered).to.equal('"someKey"?: string')
    })

    describe('when the target = "accessor"', () => {
      it('Can successfully parse functions', () => {
        const zodAst = secureEvaluateSchema(
          `z.function({input: z.tuple([z.string(), z.number()]), output: z.boolean()})`,
        )

        const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

        const rendered = mapper.renderField(zodAst.schema!)

        expect(rendered).to.equal('"someKey": (...params: [string, number]) => boolean')
      })

      it('Can successfully complex combinations of types', () => {
        const zodString = `
          z.object({
            name: z.string(),
            age: z.number().int(),
            topLevel: z.function({input: z.tuple([z.boolean().optional(), z.any()]), output: z.string()}),
            more: z.object({
              details: z.string(),
              count: z.number().int(),
              exec: z.function({input: z.tuple([z.string()]), output: z.boolean().optional()}),
            }),
            tags: z.array(z.string()).optional(),
            isActive: z.boolean().default(true),
          })
        `

        const zodAst = secureEvaluateSchema(zodString)

        const mapper = new ZodToTypescriptMapper({fieldName: 'someKey'})

        const rendered = mapper.renderField(zodAst.schema!)

        // NOTE: isActive now correctly unwraps the default to get the inner boolean type
        expect(rendered).to.equal(
          '"someKey": { "name": string; "age": number; "topLevel": (...params: [boolean | undefined, any]) => string; "more": { "details": string; "count": number; "exec": (...params: [string]) => boolean | undefined }; "tags"?: Array<string>; "isActive": boolean }',
        )
      })
    })

    describe('when the target = "raw"', () => {
      it('Can successfully parse functions', () => {
        const zodAst = secureEvaluateSchema(
          `z.function({input: z.tuple([z.string(), z.number()]), output: z.boolean()})`,
        )

        const mapper = new ZodToTypescriptMapper({fieldName: 'someKey', target: 'raw'})

        const rendered = mapper.renderField(zodAst.schema!)

        expect(rendered).to.equal('"someKey": string | undefined')
      })

      it('Can successfully complex combinations of types', () => {
        const zodString = `
          z.object({
            name: z.string(),
            age: z.number().int(),
            topLevel: z.function({input: z.tuple([z.boolean().optional(), z.any()]), output: z.string()}),
            more: z.object({
              details: z.string(),
              count: z.number().int(),
              exec: z.function({input: z.tuple([z.string()]), output: z.boolean().optional()}),
            }),
            tags: z.array(z.string()).optional(),
            isActive: z.boolean().default(true),
          })
        `

        const zodAst = secureEvaluateSchema(zodString)

        const mapper = new ZodToTypescriptMapper({fieldName: 'someKey', target: 'raw'})

        const rendered = mapper.renderField(zodAst.schema!)

        // NOTE: isActive now correctly unwraps the default to get the inner boolean type
        expect(rendered).to.equal(
          '"someKey": { "name": string; "age": number; "topLevel": string | undefined; "more": { "details": string; "count": number; "exec": string | undefined }; "tags"?: Array<string>; "isActive": boolean }',
        )
      })
    })
  })
})
