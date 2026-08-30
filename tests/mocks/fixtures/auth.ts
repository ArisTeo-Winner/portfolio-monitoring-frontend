// JWT with a decodable payload so tests that call decodeJwtPayload() work.
// Header: {"alg":"HS256","typ":"JWT"}
// Payload: {"sub":"user-1","iat":1700000000,"exp":9999999999,"session_id":"sess-test-1","jti":"jti-test-1"}
const ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OSwic2Vzc2lvbl9pZCI6InNlc3MtdGVzdC0xIiwianRpIjoianRpLXRlc3QtMSJ9" +
  ".fake-signature";

export const authFixtures = {
  validEmail: "user@example.com",
  validPassword: "Password1!",
  accessToken: ACCESS_TOKEN,
};
