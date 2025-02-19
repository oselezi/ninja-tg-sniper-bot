const DEVELOPTMENT_CONFIG = {
  apiKey: "AIzaSyCERlQDhtH1tXSO3QKgUsgqoOzqPmrg7cE",
  authDomain: "ninja-development-417014.firebaseapp.com",
  projectId: "ninja-development-417014",
  storageBucket: "ninja-development-417014.appspot.com",
  messagingSenderId: "474872304575",
  appId: "1:474872304575:web:627703ddcdab9f2579c70a",
  measurementId: "G-86W9HDXV0K"
};

const PRODUCTION_CONFIG = {
  apiKey: "AIzaSyBOVvUh8oQPyZSfpp-L7As3_ljHjOEgcy8",
  authDomain: "ninja-production-417014.firebaseapp.com",
  projectId: "ninja-production-417014",
  storageBucket: "ninja-production-417014.appspot.com",
  messagingSenderId: "860338957802",
  appId: "1:860338957802:web:9834c31f91769f84875693",
  measurementId: "G-1TEJCJ5VQQ"
}


export const firebaseConfig = import.meta.env.VITE_ENV === 'production' ? PRODUCTION_CONFIG : DEVELOPTMENT_CONFIG;


console.log({ firebaseConfig })