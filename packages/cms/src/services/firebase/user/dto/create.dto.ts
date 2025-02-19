import { UserRole } from "../types/user";

export interface CreateUserDTO {
    id?: string;
    email: string;
    name: string;
    role: UserRole;
}