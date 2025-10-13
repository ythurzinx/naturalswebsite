"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Pencil, Trash2, Plus, Eye, EyeOff, Star, Ticket } from "lucide-react"
import type { Product, Coupon } from "@/lib/types"
import { getAdminProducts, saveProductOverride, deleteProduct, createNewProduct } from "@/lib/admin-products"
import { getCategories } from "@/lib/products"
import { getCoupons, saveCoupon, deleteCoupon, createNewCoupon } from "@/lib/coupons"

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false)

  const ADMIN_PASSWORD = "mundonatural2024"

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts()
      loadCoupons()
    }
  }, [isAuthenticated])

  useEffect(() => {
    filterProducts()
  }, [products, searchQuery, selectedCategory])

  const loadProducts = async () => {
    const data = await getAdminProducts()
    setProducts(data)
  }

  const loadCoupons = () => {
    const data = getCoupons()
    setCoupons(data)
  }

  const filterProducts = () => {
    let filtered = products

    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.categoria === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) => p.nome_produto.toLowerCase().includes(query) || p.categoria.toLowerCase().includes(query),
      )
    }

    setFilteredProducts(filtered)
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert("Senha incorreta!")
    }
  }

  const handleSaveProduct = (product: Product) => {
    saveProductOverride(product)
    loadProducts()
    setIsProductDialogOpen(false)
    setEditingProduct(null)
  }

  const handleDeleteProduct = (productId: string) => {
    if (confirm("Tem certeza que deseja remover este produto?")) {
      deleteProduct(productId)
      loadProducts()
    }
  }

  const handleSaveCoupon = (coupon: Coupon) => {
    saveCoupon(coupon)
    loadCoupons()
    setIsCouponDialogOpen(false)
    setEditingCoupon(null)
  }

  const handleDeleteCoupon = (couponId: string) => {
    if (confirm("Tem certeza que deseja remover este cupom?")) {
      deleteCoupon(couponId)
      loadCoupons()
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, product: Product) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const updatedProduct = { ...product, imagem: reader.result as string }
        setEditingProduct(updatedProduct)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: "url(/images/loja-fachada.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <Card className="w-full max-w-md relative z-10">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Painel Administrativo</CardTitle>
            <p className="text-center text-muted-foreground">Mundo Natural</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const categories = getCategories(products)

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "url(/images/loja-fachada.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm" />
      <div className="relative z-10">
        <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-green-700">Painel Administrativo</h1>
              <Button variant="outline" onClick={() => setIsAuthenticated(false)}>
                Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="products" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="coupons">Cupons de Desconto</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingProduct(createNewProduct())
                        setIsProductDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingProduct?.id.startsWith("new-") ? "Novo Produto" : "Editar Produto"}
                      </DialogTitle>
                    </DialogHeader>
                    {editingProduct && (
                      <ProductForm
                        product={editingProduct}
                        onSave={handleSaveProduct}
                        onCancel={() => {
                          setIsProductDialogOpen(false)
                          setEditingProduct(null)
                        }}
                        onImageUpload={handleImageUpload}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {product.imagem && (
                          <img
                            src={product.imagem || "/placeholder.svg"}
                            alt={product.nome_produto}
                            className="w-full sm:w-24 h-24 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{product.nome_produto}</h3>
                            {product.isFeatured && <Star className="h-4 w-4 text-primary fill-primary" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{product.categoria}</p>
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Peso:</span> {product.peso_produto}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Preço:</span> R${" "}
                              {product.valor_unitario.toFixed(2)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Estoque:</span> {product.quantidade}
                            </div>
                            {product.validade && (
                              <div>
                                <span className="text-muted-foreground">Validade:</span> {product.validade}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex sm:flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(product)
                              setIsProductDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Nenhum produto encontrado</div>
              )}
            </TabsContent>

            <TabsContent value="coupons" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Cupons de Desconto</h2>
                <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingCoupon(createNewCoupon())
                        setIsCouponDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Cupom
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingCoupon?.id.startsWith("coupon-") && !editingCoupon.code ? "Novo Cupom" : "Editar Cupom"}
                      </DialogTitle>
                    </DialogHeader>
                    {editingCoupon && (
                      <CouponForm
                        coupon={editingCoupon}
                        onSave={handleSaveCoupon}
                        onCancel={() => {
                          setIsCouponDialogOpen(false)
                          setEditingCoupon(null)
                        }}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {coupons.map((coupon) => (
                  <Card key={coupon.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Ticket className="h-5 w-5 text-primary" />
                            <h3 className="font-bold text-xl">{coupon.code}</h3>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                coupon.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {coupon.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Desconto:</span>{" "}
                              {coupon.discountType === "percentage"
                                ? `${coupon.discount}%`
                                : `R$ ${coupon.discount.toFixed(2)}`}
                            </div>
                            {coupon.minPurchase && (
                              <div>
                                <span className="text-muted-foreground">Compra mínima:</span> R${" "}
                                {coupon.minPurchase.toFixed(2)}
                              </div>
                            )}
                            {coupon.expiryDate && (
                              <div>
                                <span className="text-muted-foreground">Validade:</span>{" "}
                                {new Date(coupon.expiryDate).toLocaleDateString()}
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Usos:</span> {coupon.usedCount}
                              {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCoupon(coupon)
                              setIsCouponDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteCoupon(coupon.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {coupons.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Nenhum cupom cadastrado</div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

function ProductForm({
  product,
  onSave,
  onCancel,
  onImageUpload,
}: {
  product: Product
  onSave: (product: Product) => void
  onCancel: () => void
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, product: Product) => void
}) {
  const [formData, setFormData] = useState(product)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="imagem">Imagem do Produto</Label>
        <div className="flex items-center gap-4">
          {formData.imagem && (
            <img src={formData.imagem || "/placeholder.svg"} alt="Preview" className="w-24 h-24 object-cover rounded" />
          )}
          <div className="flex-1">
            <Input id="imagem" type="file" accept="image/*" onChange={(e) => onImageUpload(e, formData)} />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="featured"
          checked={formData.isFeatured || false}
          onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
        />
        <Label htmlFor="featured" className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Produto em Destaque (aparece no carrossel)
        </Label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do Produto</Label>
          <Input
            id="nome"
            value={formData.nome_produto}
            onChange={(e) => setFormData({ ...formData, nome_produto: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <Input
            id="categoria"
            value={formData.categoria}
            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="peso">Peso/Tamanho</Label>
          <Input
            id="peso"
            value={formData.peso_produto}
            onChange={(e) => setFormData({ ...formData, peso_produto: e.target.value })}
            placeholder="Ex: 500g, 1kg, A granel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="preco">Preço Unitário (R$)</Label>
          <Input
            id="preco"
            type="number"
            step="0.01"
            value={formData.valor_unitario}
            onChange={(e) => setFormData({ ...formData, valor_unitario: Number.parseFloat(e.target.value) })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade em Estoque</Label>
          <Input
            id="quantidade"
            type="number"
            value={formData.quantidade}
            onChange={(e) => setFormData({ ...formData, quantidade: Number.parseInt(e.target.value) })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="validade">Data de Validade</Label>
          <Input
            id="validade"
            type="date"
            value={formData.validade || ""}
            onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  )
}

function CouponForm({
  coupon,
  onSave,
  onCancel,
}: {
  coupon: Coupon
  onSave: (coupon: Coupon) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState(coupon)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Código do Cupom</Label>
        <Input
          id="code"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          placeholder="Ex: BEMVINDO10"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="discountType">Tipo de Desconto</Label>
        <Select
          value={formData.discountType}
          onValueChange={(value: "percentage" | "fixed") => setFormData({ ...formData, discountType: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
            <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discount">Valor do Desconto {formData.discountType === "percentage" ? "(%)" : "(R$)"}</Label>
        <Input
          id="discount"
          type="number"
          step="0.01"
          value={formData.discount}
          onChange={(e) => setFormData({ ...formData, discount: Number.parseFloat(e.target.value) })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="minPurchase">Compra Mínima (R$) - Opcional</Label>
        <Input
          id="minPurchase"
          type="number"
          step="0.01"
          value={formData.minPurchase || ""}
          onChange={(e) =>
            setFormData({ ...formData, minPurchase: e.target.value ? Number.parseFloat(e.target.value) : undefined })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expiryDate">Data de Validade - Opcional</Label>
        <Input
          id="expiryDate"
          type="date"
          value={formData.expiryDate || ""}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="usageLimit">Limite de Usos - Opcional</Label>
        <Input
          id="usageLimit"
          type="number"
          value={formData.usageLimit || ""}
          onChange={(e) =>
            setFormData({ ...formData, usageLimit: e.target.value ? Number.parseInt(e.target.value) : undefined })
          }
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
        <Label htmlFor="isActive">Cupom Ativo</Label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  )
}
