import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set("axehealth_token", "", { maxAge: 0, path: "/" });
  return response;
}
