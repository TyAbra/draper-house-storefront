import AdminClient from "@/app/admin/admin-client";
import { listAllAdminProductsAction } from "@/app/admin/actions";

export default async function AdminPage() {
  const result = await listAllAdminProductsAction();

  return (
    <AdminClient
      initialProducts={result.products}
      initialError={result.error}
    />
  );
}
