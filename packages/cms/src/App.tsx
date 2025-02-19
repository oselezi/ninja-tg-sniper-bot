import { useCallback } from "react";

import { useDataEnhancementPlugin } from "@firecms/data_enhancement";

import { User as FirebaseUser } from "firebase/auth";
import { Authenticator, FirebaseCMSApp } from "firecms";

import "typeface-rubik";
import "@fontsource/ibm-plex-mono";

import { firebaseConfig } from "./firebase-config.ts";

import logo from './assets/ninja.jpeg'
import { userService } from "./services/firebase/user/index.ts";
import { UserRole } from "./services/firebase/user/types/user.ts";
import { accountsCollection } from "./collections/accounts.tsx";
import { analysisTrendsCollection } from './collections/analysis-trends.tsx'
import { analysisMetaCollection } from './collections/analysis-meta'

export default function App() {


  const myAuthenticator: Authenticator<FirebaseUser> = useCallback(async ({ user }) => {
    if (!user) throw new Error("User not found");

    let _user = await userService.getById(user?.uid)

    if (!_user) {
      _user = await userService.create({
        id: String(user?.uid),
        email: String(user?.email),
        name: String(user?.displayName) || String(user.email),
        role: UserRole.USER,
      });
    }

    if (_user.role !== UserRole.ADMIN) throw new Error("User not allowed");

    return true;
  }, []);


  const dataEnhancementPlugin = useDataEnhancementPlugin({
    // Paths that will be enhanced
    getConfigForPath: ({ path }) => {
      return true;
    }
  });

  return <FirebaseCMSApp
    name={"$NINJA"}
    logo={logo}
    logoDark={logo}
    plugins={[dataEnhancementPlugin]}
    authentication={myAuthenticator}
    collections={[accountsCollection, analysisMetaCollection, analysisTrendsCollection]}
    firebaseConfig={firebaseConfig}
  />;
}
