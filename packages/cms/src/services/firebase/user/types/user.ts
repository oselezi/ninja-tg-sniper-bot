export enum UserRole {
    ADMIN = "admin",
    USER = "user"
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}