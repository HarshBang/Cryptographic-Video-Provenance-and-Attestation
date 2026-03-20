import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
    UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'REGION_XXXXX', // e.g., us-east-1_xxxxxxxxx
    ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX' // Your App Client ID
};

export const userPool = new CognitoUserPool(poolData);
