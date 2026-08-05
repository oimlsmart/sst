import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const docs = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/docs' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    eyebrow: z.string().optional(),
    shortTitle: z.string().optional(),
    sidebar: z.boolean().default(true),
    order: z.number().optional(),
  }),
})

export const collections = { docs }
