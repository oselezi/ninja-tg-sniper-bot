import { encryptDecryptText } from './util';
const main = async () => {
  const test = encryptDecryptText();

  const or =
    '2s5yUrvQTpsFFeBvicQYG2mzbCNsTtgsYX8M2uNdgimXPA7qQ4YL5vTGf3sAXLxReskttoNPGwJkwTtYKouVfEaq';

  const encrypted = await test.encrypt(or);
  console.log(encrypted);

  const de = await test.decrypt(encrypted);
  console.log(de);

  console.log('Status: 200 OK', or == de);
};
main();
