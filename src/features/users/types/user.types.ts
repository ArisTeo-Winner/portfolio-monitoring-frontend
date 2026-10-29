export type UserResponse = {
  username: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  dateOfBirth: string | null;
  active: boolean;
  createdAt: string;
  preferredCurrency: string;
  timezone: string;
};
