export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface FirebaseRegisterDto {
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface FirebaseLoginDto {
  idToken: string;
}

export interface TokenResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    photoUrl?: string;
    role: string;
    permissions?: string[];
  };
}