import { z } from 'zod';
const schema = z.object({
  path: z.string().describe('File path'),
  limit: z.number().int().optional(),
  mode: z.enum(['a','b']).default('a'),
  tags: z.array(z.string()).optional(),
});
console.log('INPUT_MODE:', JSON.stringify(z.toJSONSchema(schema, { io: 'input', target: 'draft-7' })));
