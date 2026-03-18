import { Request } from 'express';
import { IJWTPayload } from './jwt-payload.interface';

export interface UserRequest extends Request {
  user: IJWTPayload;
}
