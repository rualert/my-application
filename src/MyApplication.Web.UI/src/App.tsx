import { Loader, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { GoogleLoginButton } from "./auth/GoogleLoginButton";
import { NotesApp } from "./notes/components/NotesApp";

import "@mantine/core/styles.css";

const queryClient = new QueryClient();

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <GoogleLoginButton />
      </div>
    );
  }

  return <NotesApp />;
}

export function App() {
  return (
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
