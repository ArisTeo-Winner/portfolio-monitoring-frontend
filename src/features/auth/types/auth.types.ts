export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export type JwtResponse = {
  accessToken: string;
  refreshToken: string;
};

export type UserResponse = {
  id?: string;
  username?: string;
  email?: string;
};
