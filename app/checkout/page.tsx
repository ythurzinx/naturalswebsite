    title: "Cupom inválido",
        description: validation.message,
        variant: "destructive",
      })
      return
    }

    if (validation.coupon) {
      const discount = calculateDiscount(validation.coupon, cart.total)
      setAppliedCoupon(validation.coupon)
      setCouponDiscount(discount)
      toast({
        title: "Cupom aplicado!",
        description: `Desconto de ${formatPrice(discount)} aplicado`,
      })
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponDiscount(0)
    setCouponCode("")
  }

  const handleFinishOrder = async () => {
    if (shippingCost == null) {
      toast({
        title: "Calcule o frete",
        description: "Por favor, calcule o frete antes de finalizar.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      if (appliedCoupon) {
        incrementCouponUsage(appliedCoupon.id)
      }

      toast({
        title: "Pedido realizado!",
        description: "Entraremos em contato para confirmar o pagamento.",
      })

      clearCart()
      router.push("/")
    } catch (error: unknown) {
      console.error("[checkout] Failed to finish order", error)
      toast({
        title: "Erro ao processar pedido",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (cart.items.length === 0) {
    if (typeof window !== "undefined") {
      router.replace("/carrinho")
    }
    return null
  }

  const subtotal = cart.total
  const totalWithDiscount = subtotal - couponDiscount
  const total =
    shippingCost != null ? totalWithDiscount + shippingCost : totalWithDiscount

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Finalizar Compra</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Calcular Frete</CardTitle>
                </CardHeader>
                <CardContent>
                  <ShippingCalculator onShippingCalculated={handleShippingCalculated} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Cupom de Desconto
                  </CardTitle>
