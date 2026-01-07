export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  roleId: string;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  roleId?: string;
  password?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}