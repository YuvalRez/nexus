import ProtectedRoute from "@/components/ProtectedRoute";

export default function NexusLayout({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
