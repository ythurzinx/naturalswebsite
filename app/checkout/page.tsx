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
    } catch (error) {
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
  const total = shippingCost ? totalWithDiscount + shippingCost : totalWithDiscount

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

