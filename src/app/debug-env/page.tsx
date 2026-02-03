import { env } from "~/env";

export default function DebugEnv() {
  return (
    <div className="p-8">
      <h1 className="mb-4 font-bold text-2xl">Environment Debug</h1>
      <div className="space-y-2 font-mono text-sm">
        <div>
          <strong>AUTH_URL:</strong> {env.AUTH_URL || "NOT SET"}
        </div>
        <div>
          <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
        </div>
        <div>
          <strong>Has Google Client ID:</strong>{" "}
          {env.GOOGLE_CLIENT_ID ? "YES" : "NO"}
        </div>
        <div>
          <strong>Has Auth Secret:</strong> {env.AUTH_SECRET ? "YES" : "NO"}
        </div>
      </div>
    </div>
  );
}
