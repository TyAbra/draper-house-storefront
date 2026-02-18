import AdminClient from "@/app/admin/admin-client";
import { listAdminProductsAction } from "@/app/admin/actions";

export default async function AdminPage() {
  const result = await listAdminProductsAction();

  return (
    <AdminClient
      initialProducts={result.products}
      initialError={result.error}
    />
  );
}
