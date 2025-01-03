import 'dotenv/config';
import { z } from 'zod';

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const numericRegex = /^\d+$/;
const privateKeyRegex = /^([a-fA-F0-9]{64})$/;

const envSchema = z.object({
    IEXEC_VOUCHER_MANAGER_ACCOUNT_INDEX: z
        .string()
        .optional()
        .refine(
            (val) => val === undefined || numericRegex.test(val),
            'Must be a numeric index if provided',
        ),
    IEXEC_VOUCHER_MINTER_ACCOUNT_INDEX: z
        .string()
        .optional()
        .refine(
            (val) => val === undefined || numericRegex.test(val),
            'Must be a numeric index if provided',
        ),
    IS_LOCAL_FORK: z.preprocess(
        (val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : val === true),
        z.boolean().default(false),
    ),
    MNEMONIC: z.string().optional(),
    PROD_PRIVATE_KEY: z.string().regex(privateKeyRegex, 'Invalid private key format').optional(),
    IEXEC_POCO_ADDRESS: z
        .string()
        .regex(addressRegex, 'Invalid Ethereum address if provided')
        .optional(),
    FACTORY: z.preprocess(
        (val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : val === true),
        z.boolean().default(false),
    ),
});

export const env = envSchema.parse(process.env);
