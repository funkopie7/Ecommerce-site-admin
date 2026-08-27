import { demoProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

const orders = [
  ["#MC-1048", "Aarav Mehta", "₹2,698.00", "Packed"],
  ["#MC-1047", "Naina Shah", "₹1,299.00", "Ready to ship"],
  ["#MC-1046", "Kabir Rao", "₹4,590.00", "Delivered"],
];

export default function AdminHome() {
  return <main className="shell">
    <aside><a className="brand">Mercury<span>°</span></a><p className="workspace">COMMERCE OPERATIONS</p><nav><a className="active">Overview</a><a>Products <b>24</b></a><a>Categories</a><a>Inventory</a><a>Orders <b>7</b></a><a>Customers</a></nav><div className="profile"><i>AK</i><div><strong>Ansh Kumar</strong><small>Administrator</small></div></div></aside>
    <section className="content"><header><div><p className="eyebrow">Thursday, 27 August</p><h1>Good morning, Ansh.</h1></div><div className="headerActions"><button className="search">⌕ &nbsp; Search</button><button className="primary">+ Add product</button></div></header>
      <section className="metrics"><article><p>Today’s revenue</p><strong>₹48,260</strong><em>↗ 18.2% vs yesterday</em></article><article><p>Orders to fulfil</p><strong>07</strong><em className="amber">2 require your attention</em></article><article><p>Inventory value</p><strong>₹3.84L</strong><em>Across 24 active products</em></article></section>
      <div className="sectionHead"><div><p className="eyebrow">CATALOG HEALTH</p><h2>Products needing attention</h2></div><button className="textButton">View inventory →</button></div>
      <section className="productGrid">{demoProducts.map((product) => <article className="product" key={product.sku}><img src={product.image} alt=""/><div><div className="productTop"><span>{product.category}</span><i className={product.status === "Live" ? "live" : "draft"}>{product.status}</i></div><h3>{product.name}</h3><p>{product.sku} · {formatMoney(product.price)}</p><footer><strong className={product.stock < 10 ? "low" : ""}>{product.stock} in stock</strong><button>Manage →</button></footer></div></article>)}</section>
      <div className="sectionHead ordersHead"><div><p className="eyebrow">FULFILMENT QUEUE</p><h2>Latest orders</h2></div><button className="textButton">View all orders →</button></div>
      <section className="orders"><div className="orderLabels"><span>Order</span><span>Customer</span><span>Total</span><span>Status</span></div>{orders.map((order) => <div className="order" key={order[0]}><strong>{order[0]}</strong><span>{order[1]}</span><span>{order[2]}</span><i>{order[3]}</i></div>)}</section>
    </section>
  </main>;
}
