import { z } from 'zod';

export const yourDetailsSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.email('Enter a valid email address'),
});

