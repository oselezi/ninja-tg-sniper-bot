import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "..";
import { User } from "./types/user";
import { CreateUserDTO } from "./dto/create.dto";
import { nanoid } from "nanoid";

class UserService {
    private collection = collection(db, "users");

    async getById(id: string): Promise<User | null> {
        try {
            const s = await getDoc(doc(this.collection, id))

            if (!s.exists()) return null;

            const data = s.data();

            return {
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.role,
            }

        } catch (error) {
            console.log('getById', error)
            return null;
        }
    }

    async create(input: CreateUserDTO): Promise<User> {
        const id = input.id || nanoid();

        try {
            await setDoc(doc(this.collection, id), input);

        } catch (error) {
            console.log('create', error)
        }


        return {
            id,
            email: input.email,
            name: input.name,
            role: input.role,
        }
    }
}

export const userService = new UserService();