"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShoppingBag, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PRODUCTS } from "@/lib/data";
import { parseJsonSafe, type ProductData } from "@/lib/cms-types";
import { PayPalCheckout } from "@/components/PayPalButtons";
import { createRecord, listRecords, type ShopOrderData, type SiteRecord } from "@/lib/sitedata";

type DisplayProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  sizes: string[];
  stock: Record<string, number>;
};

function mapSeed(): DisplayProduct[] {
  return PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image,
    description: p.description,
    category: p.category,
    sizes: [...p.sizes],
    stock: { ...(p.stock as unknown as Record<string, number>) },
  }));
}

function mapRemote(rec: SiteRecord<ProductData>): DisplayProduct | null {
  if (rec.data.record_status === "archived" || rec.data.active === false) return null;
  return {
    id: rec.data.sku || rec.id,
    name: rec.data.name,
    price: Number(rec.data.price_gbp),
    image: rec.data.image_url || "/images/shop-tshirt.jpg",
    description: rec.data.description || "",
    category: rec.data.category || "Merch",
    sizes: parseJsonSafe<string[]>(rec.data.sizes_json, ["One Size"]),
    stock: parseJsonSafe<Record<string, number>>(rec.data.stock_json, {}),
  };
}

export default function ShopPage() {
  const { add, lines, setQty, remove, clear, total, count } = useCart();
  const { user, siteDataReady } = useAuth();
  const [products, setProducts] = useState<DisplayProduct[]>(mapSeed());
  const [selectedSize, setSelectedSize] = useState<Record<string, string>>({});
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [payMode, setPayMode] = useState<"collection" | "paypal">("collection");

  useEffect(() => {
    listRecords<ProductData>("products", 100)
      .then((rows) => {
        const mapped = rows.map(mapRemote).filter(Boolean) as DisplayProduct[];
        if (mapped.length) setProducts(mapped);
      })
      .catch(() => {
        /* keep seed */
      });
  }, []);

  useEffect(() => {
    setSelectedSize((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (!next[p.id] && p.sizes[0]) next[p.id] = p.sizes[0];
      }
      return next;
    });
  }, [products]);

  const priceMap = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p]));
    return m;
  }, [products]);

  function addToCart(p: DisplayProduct) {
    const size = selectedSize[p.id] || p.sizes[0];
    if (!size) {
      setError("Choose a size");
      return;
    }
    const stock = p.stock[size];
    if (typeof stock === "number" && stock <= 0) {
      setError(`${p.name} in ${size} is out of stock`);
      return;
    }
    setError(null);
    add(p.id, size, 1, { unitPrice: p.price, name: p.name });
  }

  function buildItems() {
    return lines.map((l) => {
      const p = priceMap.get(l.productId);
      return {
        id: l.productId,
        name: l.name || p?.name || l.productId,
        size: l.size,
        price: l.unitPrice ?? p?.price ?? 0,
        qty: l.qty,
      };
    });
  }

  async function placeOrder(payment_status: string, notes?: string) {
    if (lines.length === 0) throw new Error("Your bag is empty.");
    for (const l of lines) {
      if (!l.size) throw new Error("Every item needs a size.");
    }
    if (!siteDataReady) throw new Error("Orders need the live site data backend.");
    await createRecord<ShopOrderData>("shop_orders", {
      member_id: user?.id || "",
      customer_name: name.trim(),
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      items_json: JSON.stringify(buildItems()),
      total_gbp: total,
      record_status: "new",
      payment_status,
      fulfillment_notes: notes || "Collect at class / social or arrange with studio",
    });
    clear();
    setDone(true);
  }

  async function checkout(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (payMode === "paypal") {
      setError("Use the PayPal buttons below to pay by card.");
      return;
    }
    setBusy(true);
    try {
      await placeOrder("pay_on_collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-line pt-28 pb-12 md:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(232,160,23,0.12),transparent_55%)]" />
        <div className="container-page">
          <p className="section-label">Shop</p>
          <h1 className="mt-3 font-display text-4xl tracking-wide md:text-6xl">Wear the boogie</h1>
          <p className="mt-4 max-w-2xl text-muted">
            Choose your size, order online, pay on collection at class or social.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <article key={p.id} className="card-surface flex flex-col overflow-hidden">
                <div className="relative aspect-square bg-surface">
                  <Image src={p.image} alt={p.name} fill className="object-cover" sizes="33vw" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-accent">{p.category}</p>
                  <h2 className="mt-1 font-display text-2xl tracking-wide">{p.name}</h2>
                  <p className="mt-2 flex-1 text-sm text-muted">{p.description}</p>
                  <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">
                    Size
                    <select
                      value={selectedSize[p.id] || p.sizes[0]}
                      onChange={(e) => setSelectedSize((s) => ({ ...s, [p.id]: e.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-semibold text-foreground"
                    >
                      {p.sizes.map((size) => {
                        const stock = p.stock[size];
                        const oos = typeof stock === "number" && stock <= 0;
                        return (
                          <option key={size} value={size} disabled={oos}>
                            {size}
                            {typeof stock === "number" ? (oos ? " — sold out" : ` (${stock} left)`) : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-lg font-bold text-accent">£{p.price.toFixed(2)}</span>
                    <button type="button" onClick={() => addToCart(p)} className="btn-primary !px-4 !py-2 text-sm">
                      <ShoppingBag size={16} /> Add
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="card-surface h-fit p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-2xl tracking-wide">Your bag ({count})</h2>
            {done ? (
              <p className="mt-4 text-sm text-accent">
                Order placed with sizes noted. We&apos;ll prepare it for collection.
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {lines.length === 0 && <p className="text-sm text-muted">Bag is empty.</p>}
                  {lines.map((l) => {
                    const p = priceMap.get(l.productId);
                    const label = l.name || p?.name || l.productId;
                    const price = l.unitPrice ?? p?.price ?? 0;
                    const img = p?.image || "/images/shop-tshirt.jpg";
                    return (
                      <div key={`${l.productId}-${l.size}`} className="flex items-center gap-3 text-sm">
                        <div className="relative h-14 w-14 overflow-hidden rounded-lg">
                          <Image src={img} alt="" fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-cream">{label}</div>
                          <div className="text-accent">Size: {l.size}</div>
                          <div className="text-muted">£{price.toFixed(2)}</div>
                          <input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => setQty(l.productId, l.size, Number(e.target.value))}
                            className="mt-1 w-16 rounded border border-line bg-bg px-2 py-1"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(l.productId, l.size)}
                          aria-label="Remove"
                        >
                          <Trash2 size={16} className="text-muted" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-between border-t border-line pt-4 font-bold">
                  <span>Total</span>
                  <span className="text-accent">£{total.toFixed(2)}</span>
                </div>
                <form onSubmit={checkout} className="mt-6 space-y-3">
                  <input
                    required
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm"
                  />
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm"
                  />
                  <input
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm"
                  />
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={payMode === "collection"}
                        onChange={() => setPayMode("collection")}
                      />
                      Pay on collection
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={payMode === "paypal"}
                        onChange={() => setPayMode("paypal")}
                      />
                      Pay by card (PayPal)
                    </label>
                  </div>
                  {payMode === "paypal" && total > 0 && name && email && (
                    <PayPalCheckout
                      amountGbp={total}
                      description={`Boots N Boogie merch order for ${name}`}
                      onPaid={async (d) => {
                        setBusy(true);
                        try {
                          await placeOrder("paid", `PayPal ${d.orderId}`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Order failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || lines.length === 0}
                    />
                  )}
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  {payMode === "collection" && (
                    <button
                      type="submit"
                      disabled={busy || lines.length === 0}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {busy ? "Placing order…" : "Place order (pay on collection)"}
                    </button>
                  )}
                </form>
              </>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
