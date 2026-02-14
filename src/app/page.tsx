type Product = {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
};

const mockProducts: Product[] = [
  { id: 1, name: "Draper Sofa", price: 1299, inStock: true },
  { id: 2, name: "Walnut Coffee Table", price: 549, inStock: true },
  { id: 3, name: "Linen Accent Chair", price: 699, inStock: false },
  { id: 4, name: "Brass Floor Lamp", price: 249, inStock: true },
];

export default function Home() {
  return (
    <main>
      <h1>Draper House Products</h1>
      <ul>
        {mockProducts.map((product) => (
          <li key={product.id}>
            {product.name} - ${product.price} - {product.inStock ? "In stock" : "Out of stock"}
          </li>
        ))}
      </ul>
    </main>
  );
}
