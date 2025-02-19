import { Injectable } from '@nestjs/common';
import { InjectFirebaseAdmin, FirebaseAdmin } from 'nestjs-firebase';
import { z } from 'zod';
import { CollectionReference, DocumentData } from 'firebase-admin/firestore';

@Injectable()
export class FirestoreService {
  private static db: FirebaseFirestore.Firestore;
  constructor(
    @InjectFirebaseAdmin()
    private readonly firebase: FirebaseAdmin,
  ) {
    if (!FirestoreService.db) {
      FirestoreService.initFirestore(this.firebase);
    }
  }

  private static initFirestore(firebase: FirebaseAdmin) {
    const firestore = firebase.firestore;
    firestore.settings({ ignoreUndefinedProperties: true });
    FirestoreService.db = firestore;
  }

  collection<T>(collectionPath: string, schema: z.Schema<T>): FirestoreCRUD<T> {
    const db = this.getFirestore();
    const collectionRef = db.collection(collectionPath);
    return new FirestoreCRUD<T>(collectionRef, schema);
  }

  getFirestore() {
    return FirestoreService.db;
  }
}

export class FirestoreCRUD<T> {
  constructor(
    private collection: CollectionReference<DocumentData>,
    private schema: z.Schema<T>,
  ) {}

  get rawCollection() {
    return this.collection;
  }

  async create(id: string, data: T): Promise<T> {
    // Validate data against the schema
    const validatedData = this.schema.parse(data);
    await this.collection.doc(id).set(validatedData);
    return validatedData;
  }

  async get(id: string): Promise<T | undefined> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return undefined;
    // Assume data fits the schema if it exists in the collection
    return doc.data() as T;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    // Partially validate data against the schema
    // @ts-ignore
    const partialSchema = this.schema.partial();
    const validatedData = partialSchema.parse(data);
    await this.collection.doc(id).update(validatedData);
    // @ts-ignore
    data.updatedAt = new Date();
    const updatedDoc = await this.collection.doc(id).get();
    return updatedDoc.data() as T;
  }

  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }
}
