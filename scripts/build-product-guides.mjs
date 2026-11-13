// Conteúdo editorial inicial: cada ID recebe uma ficha própria. As bases de
// ingrediente compartilham referências; as receitas são adaptações culinárias.
// Alterações feitas no admin ficam no MySQL e prevalecem sobre este arquivo.
import { readFile, writeFile } from "node:fs/promises";
const catalog = JSON.parse(
  await readFile(new URL("../lib/catalog.json", import.meta.url), "utf8"),
);
const sources = {
  guide: {
    title: "Ministério da Saúde — Guia Alimentar para a População Brasileira",
    url: "https://www.gov.br/saude/pt-br/assuntos/saude-brasil/publicacoes-para-promocao-a-saude/guia_alimentar_populacao_brasileira_2ed.pdf/view",
  },
  taco: {
    title: "NEPA/Unicamp — Tabela Brasileira de Composição de Alimentos",
    url: "https://www.nepa.unicamp.br/publicacoes/tabela-taco-excel/",
  },
  tbca: {
    title: "USP/FoRC — Tabela Brasileira de Composição de Alimentos",
    url: "https://www.tbca.net.br/",
  },
  soy: {
    title: "Embrapa — Receitas práticas com soja",
    url: "https://www.embrapa.br/busca-de-publicacoes/-/publicacao/457079/receitas-praticas-com-soja",
  },
  nuts: {
    title: "Embrapa — Alimentos à base de castanha-do-brasil",
    url: "https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/504925/1/alimentoscastanhabrasil.pdf",
  },
  banana: {
    title: "Embrapa — Uso da farinha de banana-verde na alimentação",
    url: "https://www.infoteca.cnptia.embrapa.br/infoteca/handle/doc/1069029",
  },
  herbs: {
    title: "Anvisa — Espécies vegetais para chás e especiarias (IN 159/2022)",
    url: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=1686&cod_modulo=135&link=S&numeroAto=00000159&orgao=ANVISA%2FMS&seqAto=000&tipo=INM&valorAno=2022",
  },
  plant: {
    title: "Ministério da Saúde — Plantas medicinais e fitoterápicos",
    url: "https://www.gov.br/saude/pt-br/composicao/sectics/plantas-medicinais-e-fitoterapicos",
  },
  supplement: {
    title: "Anvisa — Perguntas frequentes sobre suplementos alimentares",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/perguntas-frequentes",
  },
  psyllium: {
    title:
      "Ministério da Saúde — Formulário Terapêutico Nacional: psyllium e líquidos",
    url: "https://bvsms.saude.gov.br/bvs/publicacoes/formulario_terapeutico_nacional_2010.pdf",
  },
  ora: {
    title: "Embrapa — Hortaliças tradicionais: ora-pro-nóbis",
    url: "https://www.infoteca.cnptia.embrapa.br/infoteca/handle/doc/1071168",
  },
  corn: {
    title: "Alca Foods — Corn Sugar: flocos de milho com açúcar",
    url: "https://alcafoods.com/corn-sugar-flocos-de-milho-com-acucar",
  },
  cornBrown: {
    title: "Alca Foods — Especificação técnica Corn Sugar Mascavo",
    url: "https://vidaemgraos.com.br/www/wp-content/uploads/Corn-Flakes-Acucar-Mascavo-Alcafoods.pdf",
  },
};
const map = {};
function group(ids, family, extra = {}) {
  for (const n of ids) {
    if (map[n]) throw Error("ID repetido " + n);
    map[n] = { family, ...extra };
  }
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
group([92, 106, 271, 306, 329, 332, 333, 334, 337, 340], "biscuit");
group([93, 94], "soyGrain");
group([95, 96, 122], "smallGrain");
group([97, 98, 242, 250, 251], "coconut");
group(
  [99, 144, 145, 146, 244, 245, 278, 279, 280, 281, 300, 355, 385],
  "driedFruit",
);
group([100, 101, 175], "supplement");
group(
  [
    102, 103, 104, 108, 109, 110, 111, 112, 113, 114, 115, 116, 123, 130, 132,
    142, 143, 162, 267, 580, 581, 584,
  ],
  "chocolate",
);
group([124, 129, 156], "cocoa");
group([105, 107, 147, 148, 149, 150, 151, 161, 268, 269, 272, 291], "sweet");
group([117, 128], "cinnamonPowder");
group([210], "cinnamonStick");
group([118, 119, 120, 121, 134, 135, 136, 243, 362], "seed");
group([125], "psyllium");
group([126, 137, 140, 157, 218, 236, 275, 276], "specialFlour");
group([127, 285], "nutFlour");
group(
  [
    131, 133, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264,
    266, 270, 277, 283, 284, 286, 287, 288, 290, 301, 139, 141, 155,
  ],
  "nut",
);
group([138], "semolina");
group([152], "cakeMix");
group([153], "hibiscusPowder");
group([154], "candiedGinger");
group([158, 159, 160, 391], "external");
group([163, 326, 327, 328, 331, 344, 346, 347, 348, 349], "legume");
group([164], "dryVegetables");
group(range(165, 174), "spice");
group([176], "coconutMilk");
group([177], "creamMix");
group([178, 181], "sweetener");
group([179], "gelatin");
group([180, 247, 248], "sugar");
group([182], "cornmeal");
group([183, 310, 312, 313, 315], "crumb");
group(range(184, 205), "spice");
group([206], "cornCoffee");
group(
  [
    207, 208, 211, 216, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229,
    230, 232, 233, 234, 235, 238, 239, 246, 249, 372, 374, 396,
  ],
  "spice",
);
group([209], "maca");
group([212], "appleFiber");
group([213], "fenugreek");
group([214, 215, 370, 373, 375, 379, 380, 381, 382, 383, 387, 393], "herbal");
group([217, 237, 293, 294, 295, 296, 297, 298, 299], "grain");
group([231], "soyPowder");
group([240], "yeast");
group([241], "msg");
group([265, 316, 317, 318, 319], "pasta");
group([273], "gingerPowder");
group([274], "guarana");
group(
  [
    282, 302, 303, 304, 305, 309, 311, 324, 325, 335, 336, 338, 339, 341, 342,
    343, 345,
  ],
  "snack",
);
group([289, 292], "soyProtein");
group([307], "granulatedTapioca");
group([308], "cornFlakeCooking");
group([314], "bulgur");
group([320], "popcorn");
group([321, 322, 323], "hominy");
group([330], "potatoFlakes");
group([350, 351, 352, 365, 366, 367, 368, 369], "cereal");
group([353], "tapiocaGum");
group([354, 356, 357], "starch");
group([358, 359, 360, 361, 363], "oatWheat");
group([364], "bakingSoda");
group([371, 376, 377, 378, 384, 386, 389, 390, 392, 394], "tea");
group([388], "ora");
group([395], "cheese");
const storage =
  "Guarde em recipiente bem fechado, seco e limpo, longe de calor, umidade e luz direta. Use utensílio seco e respeite a validade e as condições informadas no lote.";
const allergen =
  "A composição e os possíveis traços por compartilhamento de equipamentos devem ser confirmados no rótulo do lote e com a loja. A venda a granel não significa ausência de alergênicos.";
const recipe = (
  title,
  ingredients,
  steps,
  minutes = 15,
  servings = "2 porções",
) => ({ title, ingredients, steps, minutes, servings });
const R = {
  bowl: (n) =>
    recipe(
      `Tigela de iogurte com ${n.toLowerCase()}`,
      [
        "2 potes de iogurte natural",
        "1 banana em rodelas",
        `4 colheres de sopa de ${n.toLowerCase()}`,
      ],
      [
        "Distribua o iogurte e a banana em duas tigelas.",
        "Adicione o ingrediente por cima apenas ao servir, para preservar a textura.",
        "Ajuste a porção ao seu apetite e às demais preparações da refeição.",
      ],
      5,
    ),
  salad: (n) =>
    recipe(
      `Salada com ${n.toLowerCase()}`,
      [
        `1 xícara de ${n.toLowerCase()} completamente cozido e escorrido`,
        "1 tomate picado",
        "1/2 pepino picado",
        "1 colher de sopa de azeite",
        "Suco de 1/2 limão, cheiro-verde e sal a gosto",
      ],
      [
        "Se partir do grão cru, faça o preparo indicado para o produto e cozinhe completamente em água nova; não utilize grãos crus.",
        "Deixe o grão cozido esfriar e misture com os vegetais higienizados.",
        "Tempere com azeite, limão e ervas e sirva. O tempo informado não inclui remolho ou cozimento inicial.",
      ],
      15,
    ),
  farofa: (n) =>
    recipe(
      `Farofa com ${n.toLowerCase()}`,
      [
        `4 colheres de sopa de ${n.toLowerCase()} picado, pronto para consumo`,
        "1 xícara de farinha de mandioca",
        "1/2 cebola picada",
        "1 colher de sopa de azeite",
        "Cheiro-verde a gosto",
      ],
      [
        "Refogue a cebola no azeite até ficar macia.",
        "Acrescente a farinha de mandioca e mexa em fogo baixo por 3 a 5 minutos.",
        "Desligue o fogo e misture o ingrediente picado e o cheiro-verde. Se o ingrediente for cru e exigir cocção, prepare-o antes conforme o fabricante.",
      ],
      15,
      "4 porções",
    ),
  oats: (n) =>
    recipe(
      `Mingau com ${n.toLowerCase()}`,
      [
        `3 colheres de sopa de ${n.toLowerCase()}`,
        "250 ml de leite ou bebida vegetal",
        "1/2 banana amassada",
        "Canela a gosto",
      ],
      [
        "Misture o ingrediente, o líquido e a banana numa panela.",
        "Cozinhe em fogo baixo, mexendo, por cerca de 5 a 8 minutos até hidratar, cozinhar e engrossar.",
        "Ajuste a consistência com mais líquido e finalize com canela.",
      ],
      12,
      "1 porção",
    ),
  pancake: (n) =>
    recipe(
      `Panqueca de banana com ${n.toLowerCase()}`,
      [
        "1 banana pequena amassada",
        "1 ovo",
        `1 colher de sopa de ${n.toLowerCase()}`,
        "2 colheres de sopa de farinha de aveia",
        "2 a 4 colheres de sopa de água ou leite",
        "Um fio de óleo para a frigideira",
      ],
      [
        "Misture a banana e o ovo; junte as farinhas e líquido aos poucos até obter massa espessa que escorra da colher.",
        "Aqueça uma frigideira antiaderente levemente untada.",
        "Faça discos pequenos e cozinhe em fogo baixo dos dois lados, até o centro ficar completamente cozido.",
      ],
      15,
    ),
  roasted: (n, amount = "1 colher de chá") =>
    recipe(
      `Legumes assados com ${n.toLowerCase()}`,
      [
        "400 g de batata e cenoura em pedaços",
        "1 colher de sopa de azeite",
        `${amount} de ${n.toLowerCase()}`,
        "Sal a gosto, apenas se necessário",
      ],
      [
        "Preaqueça o forno a 200 °C e corte os legumes em pedaços semelhantes.",
        "Misture azeite e tempero. Se o produto já contiver sal, prove antes de acrescentar mais.",
        "Asse por 30 a 40 minutos, virando na metade, até os legumes ficarem macios. Ajuste o tempo ao forno.",
      ],
      45,
    ),
  dessert: (n) =>
    recipe(
      `Copinho de banana com ${n.toLowerCase()}`,
      [
        "1 banana madura",
        "1 pote de iogurte natural",
        `2 colheres de sopa de ${n.toLowerCase()} em pequenos pedaços`,
      ],
      [
        "Higienize os utensílios e corte a banana em rodelas.",
        "Monte camadas de banana e iogurte em dois copinhos.",
        "Finalize com pequenas porções do doce ou chocolate apenas ao servir.",
      ],
      5,
    ),
  infusion: (n) =>
    recipe(
      `Bebida com ${n.toLowerCase()}`,
      [
        `Quantidade de ${n.toLowerCase()} indicada no rótulo para 250 ml de água`,
        "250 ml de água potável",
        "Casca de limão higienizada, opcional",
      ],
      [
        "Confirme que o produto e a parte vegetal são identificados e próprios para preparo de bebida alimentar.",
        "Prepare com água potável e siga a temperatura, quantidade e tempo de infusão da embalagem.",
        "Coe se necessário e sirva sem açúcar, ou ajuste ao seu gosto. Esta preparação é culinária, sem finalidade terapêutica.",
      ],
      10,
      "1 xícara",
    ),
};
const profiles = {};
for (const p of catalog.filter((p) => p.isGranel)) {
  const num = Number(p.id.split("-")[1]),
    m = map[num];
  if (!m) throw Error(`Ficha não classificada: ${p.id} ${p.nome_produto}`);
  const n = p.nome_produto,
    low = n.toLocaleLowerCase("pt-BR"),
    f = m.family;
  let c = {
    kind: "food",
    description: "",
    highlights: [],
    usage: "",
    storage,
    allergens: allergen,
    notes: [],
    recipe: null,
    sources: [sources.guide, sources.tbca],
  };
  if (f === "biscuit")
    Object.assign(c, {
      description: `${n} é uma opção de biscoito para servir em pequenas porções com café, chá ou em sobremesas. O sabor e a composição variam conforme o fabricante; confira a versão do lote disponível.`,
      highlights: [
        "Prático para servir e porcionar",
        "Traz textura crocante a sobremesas e acompanhamentos",
        "Combina com frutas e preparações cremosas",
      ],
      usage:
        "Sirva como acompanhamento ou esmigalhe sobre uma sobremesa. Confira ingredientes e cobertura antes de usar em receitas.",
      allergens:
        "Biscoitos podem levar trigo, leite, ovos, soja, amendoim ou castanhas, conforme a receita. " +
        allergen,
      recipe: R.dessert(n),
    });
  if (f === "soyGrain")
    Object.assign(c, {
      description: `${n} é a soja na forma de grão inteiro, indicada para preparações cozidas. Oferece proteína vegetal, fibras e textura firme, podendo compor saladas, refogados e sopas.`,
      highlights: [
        "Contém proteína vegetal e fibras próprias da soja",
        "Acrescenta textura a refeições salgadas",
        "Versátil em saladas, caldos e refogados",
      ],
      usage:
        "Faça o preparo e o cozimento completo conforme a embalagem; soja em grão não é para consumo cru. Depois de cozida, escorra e tempere a gosto.",
      allergens: "Contém soja. " + allergen,
      notes: [
        "O remolho e o cozimento não estão incluídos no tempo da sugestão de salada.",
      ],
      recipe: R.salad(n),
      sources: [sources.soy, sources.tbca],
    });
  if (f === "smallGrain")
    Object.assign(c, {
      description: `${n} reúne pequenos grãos que ganham textura delicada depois de cozidos. É uma alternativa para variar acompanhamentos, misturar a saladas e complementar preparações de arroz e legumes.`,
      highlights: [
        "Grão que ajuda a variar os acompanhamentos",
        "Contém componentes vegetais como proteína e fibras",
        "Pode ser servido quente ou frio após cozimento",
      ],
      usage:
        "Lave em peneira fina, quando indicado, e cozinhe em água conforme a embalagem. Use o grão já cozido em saladas e acompanhamentos.",
      recipe: R.salad(n),
    });
  if (f === "coconut")
    Object.assign(c, {
      description: `${n} leva o sabor característico do coco e textura ${/fino/i.test(n) ? "fina" : "em lâminas ou flocos"} a receitas doces e salgadas. Confira se o lote possui açúcar ou outros ingredientes adicionados.`,
      highlights: [
        "Sabor de coco para finalizar receitas",
        "Textura útil em coberturas, granolas e massas",
        "Pode compor preparações doces e salgadas",
      ],
      usage:
        "Use como cobertura de iogurtes, frutas e bolos ou misture à massa. Para tostar, aqueça brevemente em fogo baixo, mexendo para não queimar.",
      recipe: R.bowl(n),
    });
  if (f === "driedFruit")
    Object.assign(c, {
      description: `${n} é uma forma prática de incluir o sabor de frutas em lanches e receitas. A desidratação concentra sabor e açúcares; a apresentação e a adição de açúcar devem ser conferidas no lote.`,
      highlights: [
        "Sabor frutado e prático para pequenas porções",
        "Combina com cereais, iogurtes e massas",
        "Pode dar contraste de textura a saladas",
      ],
      usage:
        "Consuma a porção desejada ou pique para misturar a receitas. Confira caroços e, se a receita pedir, hidrate em água potável antes de usar.",
      notes: [
        /caroco/i.test(n)
          ? "Confira a presença de caroço e retire antes de servir, quando houver."
          : "Confira a composição para saber se há açúcar ou conservantes adicionados.",
      ],
      recipe: R.bowl(n),
    });
  if (f === "supplement")
    Object.assign(c, {
      kind: "supplement",
      description: `${n} é um ingrediente associado à suplementação. Sua composição, finalidade, porção e público indicado dependem da identificação e da rotulagem do fabricante; não se deve definir o uso apenas pelo nome comercial.`,
      highlights: [
        "Permite consultar a finalidade e a porção na rotulagem",
        "A composição deve ser confirmada antes do uso",
        "A orientação de uso deve considerar as necessidades individuais",
      ],
      usage:
        "Solicite à loja a identificação do fabricante e as informações do rótulo. Siga a porção e as restrições indicadas e consulte um profissional de saúde quando necessário.",
      notes: [
        "Suplementos não servem para prevenir, tratar ou curar doenças.",
        "Não foi atribuída uma dose ou receita de ingestão sem as informações do fabricante.",
      ],
      sources: [sources.supplement],
    });
  if (f === "chocolate" || f === "sweet")
    Object.assign(c, {
      description: `${n} é uma opção de ${f === "chocolate" ? "chocolate ou confeitaria com chocolate" : "doce"} para apreciar em pequenas porções e compor sobremesas. ${/gota|granulado/i.test(n) ? "Seu formato facilita distribuir sobre preparações ou incorporar a receitas." : "Pode ser servido em uma porção individual ou combinado com frutas e cremes."}`,
      highlights: [
        "Prático para montar porções de sobremesa",
        "Acrescenta sabor e textura à finalização",
        "Permite variar a apresentação de frutas e cremes",
      ],
      usage: /barra|gotas|chocolate branco/i.test(n)
        ? "Se for derreter, use recipiente seco e aquecimento suave em banho-maria ou intervalos curtos no micro-ondas. Confira se é chocolate ou cobertura e siga o fabricante."
        : "Use em pequenas porções, na finalização ou como acompanhamento. Confira a composição e a presença de recheio ou cobertura.",
      allergens:
        "Chocolates e doces podem conter leite, soja, trigo, ovos, amendoim e castanhas. " +
        allergen,
      notes: [
        "É um produto para consumo moderado; o nome “natural” da loja não significa ausência de açúcar ou aditivos.",
      ],
      recipe: R.dessert(n),
      sources: [sources.guide],
    });
  if (f === "cocoa")
    Object.assign(c, {
      description: `${n} é um ingrediente em pó para dar cor e sabor a bolos, cremes e bebidas. ${[124, 156].includes(num) ? "A indicação 50% refere-se à apresentação comercial; confirme a proporção de cacau e os demais ingredientes no lote." : "O cacau alcalino tem sabor e comportamento culinário próprios; ajuste a receita à versão indicada."}`,
      highlights: [
        "Intensifica o sabor de preparações com chocolate",
        "Ajuda a colorir massas e cremes",
        "Pode ser dosado conforme o perfil da receita",
      ],
      usage:
        "Peneire antes de incorporar a massas e dissolva aos poucos em líquidos mornos. Ajuste o açúcar somente após conferir a composição.",
      recipe: recipe(
        `Bebida quente com ${low}`,
        [
          `1 colher de chá de ${low}`,
          "200 ml de leite ou bebida vegetal",
          "Açúcar a gosto, se necessário",
        ],
        [
          "Dissolva o pó em um pouco do líquido ainda frio.",
          "Adicione o restante e aqueça em fogo baixo, mexendo.",
          "Prove e ajuste o açúcar de acordo com a composição do produto.",
        ],
        8,
        "1 xícara",
      ),
    });
  if (f === "cinnamonPowder" || f === "cinnamonStick")
    Object.assign(c, {
      description: `${n} é uma especiaria aromática usada para dar sabor a frutas, bebidas e sobremesas. ${f === "cinnamonStick" ? "Os pedaços de casca perfumam líquidos durante o aquecimento e devem ser retirados ao servir." : "A versão em pó distribui o aroma de forma uniforme em massas e coberturas."}`,
      highlights: [
        "Aroma marcante em pequenas quantidades",
        "Combina com frutas, mingaus e bebidas",
        "Ajuda a variar o sabor sem depender apenas de açúcar",
      ],
      usage:
        f === "cinnamonStick"
          ? "Aqueça com o líquido ou preparação e retire a casca antes de consumir. Use em quantidades culinárias."
          : "Adicione uma pequena pitada a frutas, mingaus ou massas, conforme a receita. Não consuma o pó puro e seco.",
      recipe:
        f === "cinnamonStick"
          ? recipe(
              "Maçã cozida com canela em pau",
              [
                "2 maçãs em cubos",
                "1 pedaço pequeno de canela em pau",
                "100 ml de água",
              ],
              [
                "Cozinhe todos os ingredientes em fogo baixo, com a panela parcialmente tampada, até a maçã amaciar.",
                "Retire a canela em pau antes de servir.",
              ],
              15,
            )
          : recipe(
              "Banana assada com canela",
              ["2 bananas", `1 pitada de ${low}`],
              [
                "Coloque as bananas cortadas num refratário.",
                "Polvilhe uma pequena pitada de canela e asse a 180 °C por cerca de 15 minutos, até amaciar.",
              ],
              20,
            ),
      sources: [sources.herbs, sources.guide],
    });
  if (f === "seed")
    Object.assign(c, {
      description: `${n} acrescenta textura e componentes vegetais a refeições. Sementes podem integrar pães, saladas e outras receitas; a forma inteira, moída ou hidratada muda o resultado culinário.`,
      highlights: [
        "Acrescenta textura a massas e saladas",
        "Contém fibras e gorduras próprias da semente",
        "Fácil de combinar com outros ingredientes",
      ],
      usage: /chia|linhaca/i.test(n)
        ? "Use em receitas com umidade ou, quando a receita pedir, triture ou hidrate previamente. Evite engolir colheradas do ingrediente seco."
        : "Adicione a pães, saladas e acompanhamentos. Se desejar tostar, faça em frigideira seca, em fogo baixo, mexendo e sem deixar queimar.",
      allergens: /gergelim/i.test(n)
        ? "Contém gergelim. " + allergen
        : allergen,
      recipe: recipe(
        `Molho com ${low}`,
        [
          `1 colher de sopa de ${low}`,
          "1 pote de iogurte natural",
          "1 colher de sopa de água",
          "Suco de 1/2 limão",
          "Ervas a gosto",
        ],
        [
          "Misture o iogurte, a água e o limão.",
          "Adicione a semente; para chia ou linhaça, deixe hidratar por pelo menos 15 minutos e ajuste com mais água se necessário.",
          "Misture as ervas e use sobre vegetais higienizados.",
        ],
        20,
      ),
    });
  if (f === "psyllium")
    Object.assign(c, {
      description:
        "Psyllium é um ingrediente de origem vegetal associado às fibras solúveis e à absorção de água. Na culinária, versões próprias para alimentos podem ajudar a dar liga e reter umidade em massas.",
      highlights: [
        "Forma gel em contato com água",
        "Pode ajudar na estrutura de massas culinárias",
        "É um ingrediente associado às fibras alimentares",
      ],
      usage:
        "Confirme a classificação e a porção do fabricante. Em uso alimentar, misture primeiro aos ingredientes úmidos e ajuste a água da receita. Nunca ingira o pó seco.",
      notes: [
        "A ingestão precisa ser acompanhada de líquidos. Dificuldade para engolir, obstrução digestiva e uso de medicamentos exigem orientação de saúde.",
      ],
      recipe: recipe(
        "Pão de frigideira com psyllium",
        [
          "1 ovo",
          "2 colheres de sopa de farinha de aveia",
          "1/2 colher de chá de psyllium próprio para uso alimentar, respeitando o rótulo",
          "3 colheres de sopa de água",
          "1/2 colher de chá de fermento químico",
        ],
        [
          "Misture a água com o psyllium e deixe hidratar por 10 minutos; deve formar gel úmido.",
          "Junte ovo e farinha e acrescente mais água se a massa ficar seca; misture o fermento por último.",
          "Cozinhe em frigideira untada e tampada, em fogo baixo, dos dois lados até o centro ficar cozido.",
        ],
        20,
      ),
      sources: [sources.psyllium, sources.supplement],
    });
  if (f === "specialFlour" || f === "nutFlour")
    Object.assign(c, {
      description: `${n} é uma alternativa para variar sabor, cor ou textura de massas. ${/beterraba|uva/i.test(n) ? "A matéria-prima dá coloração característica à preparação; não representa promessa de desempenho ou tratamento." : "A absorção de líquido difere da farinha de trigo, por isso costuma funcionar melhor em proporções ajustadas à receita."}`,
      highlights: [
        "Ajuda a variar os ingredientes das massas",
        "Pode alterar a cor e o sabor da preparação",
        "Permite testar misturas culinárias em pequenas proporções",
      ],
      usage:
        "Comece por uma receita formulada para esta farinha. Não substitua toda a farinha de outra receita na mesma proporção sem ajustar líquidos e estrutura. Cozinhe as massas antes de consumir.",
      allergens:
        f === "nutFlour"
          ? "Contém a oleaginosa indicada no nome do produto. " + allergen
          : allergen,
      recipe: R.pancake(n),
      sources:
        num === 236
          ? [sources.banana, sources.tbca]
          : [sources.tbca, sources.guide],
    });
  if (f === "nut") {
    const sweet = /doce|vermelho/i.test(n) && num !== 283;
    const flavored =
      /salsa|picante|mendorato|ovinho|alho|hanner|defumad| com sal|c\/ sal/i.test(
        n,
      );
    Object.assign(c, {
      description: `${n} é uma opção ${flavored ? "temperada, para dar sabor e crocância" : sweet ? "doce, para apreciar em pequenas porções" : "de oleaginosa, com sabor e textura característicos"}. ${flavored || sweet ? "Confira a composição da cobertura e do tempero; o nome do produto não indica ausência de açúcar, sal ou aditivos." : "As oleaginosas oferecem gorduras e proteína vegetal e podem complementar diferentes preparações."}`,
      highlights:
        flavored || sweet
          ? [
              "Textura crocante para servir em pequenas porções",
              "Sabor próprio da versão escolhida",
              "Prático para finalizar acompanhamentos ou lanches",
            ]
          : [
              "Contém gorduras e proteína vegetal próprias da oleaginosa",
              "Acrescenta crocância a receitas e acompanhamentos",
              "Versátil em porções e preparações culinárias",
            ],
      usage:
        "Sirva a porção desejada ou pique para misturar às receitas. Confirme se o produto está pronto para consumo ou se exige preparo e considere o sal e a cobertura da versão escolhida.",
      allergens:
        "Contém amendoim ou a castanha/oleaginosa indicada no nome; misturas reúnem os alergênicos de seus componentes. " +
        allergen,
      recipe: sweet ? R.dessert(n) : R.farofa(n),
      sources: [sources.tbca, sources.guide],
    });
    if (num === 258) c.sources.unshift(sources.nuts);
  }
  if (f === "semolina")
    Object.assign(c, {
      description:
        "Semolina de trigo fina é um derivado de trigo com granulação própria, usado para dar estrutura a massas e espessar preparações cozidas.",
      highlights: [
        "Granulação útil em massas e cremes",
        "Ajuda na estrutura de preparações de trigo",
        "Permite variar o preparo de um mingau ou acompanhamento",
      ],
      usage:
        "Hidrate e cozinhe conforme a receita. Por ser derivada de trigo, não é indicada para quem precisa excluir glúten.",
      allergens: "Contém trigo e glúten. " + allergen,
      recipe: R.oats(n),
    });
  if (f === "cakeMix" || f === "creamMix")
    Object.assign(c, {
      description: `${n} é uma mistura para confeitaria. Os ingredientes a acrescentar e o rendimento dependem da formulação do fabricante, por isso a receita deve ser ajustada ao rótulo do lote.`,
      highlights: [
        "Praticidade na organização da confeitaria",
        "Permite montar preparações individuais",
        "Composição e rendimento informados pelo fabricante",
      ],
      usage:
        "Solicite à loja as instruções do fabricante e siga as proporções de líquido e demais ingredientes. Não use a mistura seca como se fosse produto pronto.",
      allergens:
        "Misturas de confeitaria podem conter trigo, leite, ovos e soja. " +
        allergen,
      recipe:
        f === "cakeMix"
          ? recipe(
              "Bolinhos individuais com frutas",
              [
                `${n}: porção para 4 bolinhos conforme o rótulo`,
                "Líquidos e demais ingredientes nas quantidades indicadas pelo fabricante",
                "1/2 banana em cubinhos",
              ],
              [
                "Prepare a mistura seguindo exatamente a proporção do fabricante para a porção escolhida.",
                "Distribua em forminhas próprias e acrescente pequenos cubos de banana.",
                "Asse na temperatura e no tempo indicados, até o interior estar cozido.",
              ],
              35,
              "4 bolinhos",
            )
          : recipe(
              "Copinhos de fruta com creme preparado",
              [
                `${n}: porção indicada para 2 sobremesas`,
                "Líquido e ingredientes especificados no rótulo",
                "1 xícara de frutas higienizadas",
              ],
              [
                "Prepare o creme conforme o fabricante; se a mistura exigir refrigeração, mantenha-a refrigerada.",
                "Distribua as frutas em dois copinhos e acrescente uma pequena porção do creme preparado.",
              ],
              15,
            ),
    });
  if (f === "hibiscusPowder")
    Object.assign(c, {
      description:
        "Hibisco em pó pode agregar cor e sabor ácido a preparações quando identificado e rotulado para uso alimentar. A espécie, a parte vegetal e a formulação devem ser confirmadas no lote.",
      highlights: [
        "Coloração característica em pequenas quantidades",
        "Sabor que pode contrastar com frutas e cremes",
        "Apresentação em pó facilita dispersar na receita",
      ],
      usage:
        "Confirme que o produto é próprio para alimentação e siga a porção e as orientações do fabricante. Não atribua efeito de emagrecimento ou tratamento.",
      recipe: recipe(
        "Iogurte colorido com hibisco",
        [
          "1 pote de iogurte natural",
          "1/2 banana amassada",
          "Hibisco em pó de uso alimentar: pequena quantidade conforme o rótulo",
        ],
        [
          "Misture o iogurte e a banana.",
          "Disperse apenas a quantidade culinária indicada no rótulo e ajuste o sabor sem usar pó seco puro.",
        ],
        5,
        "1 porção",
      ),
      sources: [sources.herbs],
    });
  if (f === "candiedGinger")
    Object.assign(c, {
      description:
        "Gengibre cristalizado combina o sabor picante do gengibre com uma cobertura doce. Serve para pequenas porções e para finalizar bolos, biscoitos e sobremesas.",
      highlights: [
        "Contraste entre doce e picante",
        "Fácil de picar para incorporar a massas",
        "Pode finalizar sobremesas e bebidas",
      ],
      usage:
        "Use picado em pequenas porções. Cristalizado indica presença de açúcar no processamento, mesmo tendo origem vegetal.",
      recipe: R.dessert(n),
      sources: [sources.guide],
    });
  if (f === "external")
    Object.assign(c, {
      kind: "external",
      description: `${n} é um material cuja finalidade e classificação precisam ser confirmadas com a loja e o fornecedor. Ele não é apresentado nesta ficha como ingrediente culinário.`,
      highlights: [
        "Finalidade de uso deve constar na identificação do lote",
        "Procedência e composição precisam ser conferidas",
        "Informações editáveis pela loja conforme a rotulagem",
      ],
      usage:
        "Não ingerir nem usar em receitas. Antes de qualquer aplicação, confirme a finalidade, a classificação do produto e as orientações do fabricante. Não aplique em mucosas ou feridas sem orientação adequada.",
      notes: [
        "Não foi atribuída receita de consumo a este material.",
        "A origem natural não garante segurança em qualquer via de uso.",
      ],
      sources: [sources.plant],
    });
  if (f === "legume")
    Object.assign(c, {
      description: `${n} é uma leguminosa para preparações cozidas, como saladas, caldos e acompanhamentos. Leguminosas contribuem com proteína vegetal e fibras e ajudam a variar a combinação com cereais.`,
      highlights: [
        "Contém proteína vegetal e fibras",
        "Combina com arroz, legumes e ervas",
        "Pode compor refeições quentes ou saladas após cozimento",
      ],
      usage:
        "Faça seleção, lavagem e preparo conforme a embalagem. Use apenas depois do cozimento completo em água nova. Para grãos que pedem remolho, descarte essa água antes de cozinhar.",
      notes: [
        "O tempo da sugestão pressupõe o ingrediente já cozido; remolho e cozimento inicial dependem do grão.",
      ],
      recipe: R.salad(n),
    });
  if (f === "dryVegetables")
    Object.assign(c, {
      description:
        "Mix de legumes desidratados reúne vegetais em pedaços para dar variedade a caldos, sopas e acompanhamentos. A composição da mistura deve ser confirmada no lote.",
      highlights: [
        "Praticidade para acrescentar vegetais às preparações",
        "Textura e cores variadas após hidratação",
        "Pode compor sopas e arroz",
      ],
      usage:
        "Hidrate ou cozinhe diretamente no caldo, conforme a embalagem. Ajuste a água da receita para o ingrediente recuperar a textura.",
      recipe: recipe(
        "Sopa com legumes desidratados",
        [
          "3 colheres de sopa do mix",
          "1 batata em cubos",
          "1/2 cebola picada",
          "600 ml de água",
          "1 colher de chá de azeite",
          "Sal e ervas a gosto",
        ],
        [
          "Refogue a cebola no azeite.",
          "Junte a batata, a água e o mix e cozinhe até tudo ficar bem hidratado e macio.",
          "Ajuste o sal conforme a composição do mix e sirva.",
        ],
        30,
      ),
    });
  if (f === "spice") {
    const salt = [239, 246, 249, 396].includes(num),
      whole = [165, 167, 168, 171, 208, 219, 374].includes(num),
      hot = [166, 172, 194, 193].includes(num);
    const descriptions = {
      165: "Mistura de pimentas para moer ou infusionar no preparo; cada tipo traz aroma próprio.",
      166: "Pimenta em flocos, com textura aparente e ardência que deve ser dosada aos poucos.",
      167: "Pimenta-preta em grãos preserva o aroma até a moagem.",
      168: "Pimenta-rosa tem aroma delicado e pede pequenas quantidades na finalização.",
      169: "Pimenta-branca moída distribui sabor em molhos claros e preparações cremosas.",
      170: "Fumaça em pó é um aromatizante culinário de sabor defumado; confira ingredientes e dosagem do fabricante.",
      171: "Pimenta-da-jamaica e tempero sírio são apresentações distintas; confirme qual composição corresponde ao lote vendido.",
      172: "Pimenta-caiena oferece ardência intensa; uma pequena pitada pode bastar.",
      173: "Cebola em flocos dá textura e aroma a refogados e molhos após hidratação.",
      174: "Cebola desidratada ajuda a compor molhos, marinadas e preparações com umidade.",
      184: "Mistura de temperos de nome comercial; a composição e a presença de sal devem ser conferidas no lote.",
      185: "Zathar é uma mistura de especiarias; pode incluir ervas e gergelim conforme a receita do fabricante.",
      186: "Mistura de ervas e vegetais de nome comercial, para temperar refogados, molhos e assados.",
      187: "Mix Aromas reúne componentes aromáticos cuja composição deve ser confirmada com a loja.",
      188: "Combina o perfil aromático de cebola, salsa e alho em preparações salgadas.",
      189: "Mistura de nome comercial, para variar o sabor de preparações salgadas conforme a composição.",
      190: "Chimichurri tradicional é uma mistura de ervas e condimentos que pode ser hidratada para molhos.",
      191: "Chimichurri defumado acrescenta perfil de ervas e aroma defumado a molhos e marinadas.",
      192: "Mistura de temperos de perfil regional; confira os vegetais, condimentos e o sal do lote.",
      193: "Chimichurri com pimenta combina ervas e ardência em molhos e marinadas.",
      194: "Páprica picante contribui com cor avermelhada e ardência.",
      195: "Lemon pepper traz perfil cítrico e de pimenta; confira a presença de sal e aromatizantes.",
      196: "Páprica doce defumada agrega cor avermelhada e aroma defumado.",
      197: "Páprica doce dá cor e sabor suave a preparações salgadas.",
      198: "Tempero baiano sem pimenta permite variar o aroma; confirme os ingredientes específicos do fabricante.",
      199: "Tempero baiano fino distribui os condimentos pela preparação; confira a intensidade e a composição.",
      200: "Cúrcuma, também chamada de açafrão-da-terra, dá cor amarela e sabor característico aos alimentos.",
      201: "A denominação açafrão pode indicar produtos distintos; confirme se o lote é cúrcuma ou açafrão verdadeiro antes da receita.",
      202: "Alho granulado perfuma molhos e refogados e amacia em contato com líquidos.",
      203: "Alho frito é uma finalização crocante; considere o óleo e o sal da preparação.",
      204: "Alho em pó distribui o aroma em massas, molhos e temperos secos.",
      205: "Creme de cebola pode ser mistura para preparo; a composição pode incluir amido, leite, trigo e sal.",
      207: "Tomilho é uma erva aromática para cozinhar com legumes, molhos e assados.",
      208: "Cravo-da-índia inteiro tem aroma intenso; retire os cravos da preparação antes de servir.",
      211: "Limão desidratado agrega aroma cítrico; confira se a versão é em rodelas, raspas ou pó.",
      216: "Alho-poró desidratado pode compor caldos, refogados e molhos depois de hidratar.",
      219: "Raiz de cúrcuma precisa ser identificada quanto à apresentação e ao modo de preparo; confira o lote.",
      220: "Alecrim perfuma assados e molhos; use pequenas quantidades de folhas.",
      221: "Manjericão desidratado combina com tomates, massas e molhos.",
      222: "Ervas finas é uma mistura aromática para variar preparações salgadas; confira quais ervas compõem o lote.",
      223: "Vinagrete desidratado reúne condimentos e vegetais para hidratar e preparar molhos.",
      224: "Salsa desidratada dá aroma e cor na finalização de preparações salgadas.",
      225: "Cominho moído tem aroma intenso e combina com feijões, legumes e refogados.",
      226: "Caldo de carne é um tempero formulado; composição, alergênicos e sódio variam conforme o fabricante.",
      227: "Caldo de galinha é um tempero formulado; confira ingredientes e sal antes de acrescentar mais à receita.",
      228: "Colorau contribui com a coloração avermelhada; pode levar urucum e outros ingredientes conforme a formulação.",
      229: "Coentro em flocos agrega aroma de folhas a caldos, molhos e refogados.",
      230: "Limão e ervas finas combina perfil cítrico e ervas; confira a presença de sal.",
      232: "Coentro em pó oferece perfil aromático diferente da folha; confirme a matéria-prima do lote.",
      233: "Mostarda em pó pode dar sabor pungente e textura a molhos quando hidratada.",
      234: "Curry é uma mistura de especiarias de composição e ardência variáveis.",
      235: "Caldo de bacon é um tempero formulado, de sabor intenso; confira sal e ingredientes de origem animal.",
      238: "Noz-moscada moída tem aroma intenso e deve ser usada apenas em pequenas pitadas culinárias.",
      239: "Flor de sal é uma apresentação de sal para usar em pequenas quantidades, principalmente na finalização.",
      246: "Sal do Himalaia fino é um sal de coloração característica; o principal componente continua sendo sódio na forma de sal.",
      249: "Sal marinho é um ingrediente para ajustar o sabor salgado das preparações.",
      372: "Orégano é uma erva de aroma característico para molhos, legumes, massas e finalizações.",
      374: "Louro em folhas perfuma caldos e feijões durante o cozimento; as folhas devem ser retiradas antes de servir.",
      396: "Sal marinho é um ingrediente para ajustar o sabor salgado das preparações.",
    };
    Object.assign(c, {
      description: `${n}. ${descriptions[num] || "Ingrediente aromático para uso culinário em pequenas quantidades."}`,
      highlights: salt
        ? [
            "Realça o sabor com pequena quantidade",
            "Permite ajustar o tempero durante o preparo",
            "Pode ser usado na finalização de pratos",
          ]
        : [
            "Acrescenta aroma, sabor ou cor à receita",
            "Facilita variar legumes, molhos e acompanhamentos",
            "Pode ser dosado aos poucos conforme o paladar",
          ],
      usage: salt
        ? "Acrescente pequenas quantidades e prove antes de repetir. Sais de diferentes cores e origens também contribuem para a ingestão de sódio."
        : whole
          ? "Use conforme a apresentação do lote. Grãos podem ser moídos; folhas e especiarias inteiras devem ser retiradas quando não forem destinadas a mastigar."
          : "Adicione aos poucos durante o preparo ou finalização. Para misturas com sal, considere o sal já presente e siga a indicação do fabricante.",
      allergens:
        "Misturas de temperos podem incluir trigo, soja, leite, gergelim e outros ingredientes não evidentes pelo nome comercial. " +
        allergen,
      notes: salt
        ? ["A cor ou a origem do sal não torna o consumo livre de sódio."]
        : num === 238
          ? [
              "Use só uma pequena pitada culinária. Noz-moscada não é para consumo em grandes quantidades.",
            ]
          : [],
      recipe: R.roasted(
        n,
        hot || num === 238
          ? "1 pequena pitada"
          : salt
            ? "1 pequena pitada"
            : "1 colher de chá",
      ),
      sources: [sources.herbs, sources.guide],
    });
    if (whole && [167, 168, 171].includes(num))
      c.recipe = R.roasted(`${n} moída na hora`, "1 pequena pitada");
    if (num === 170)
      c.recipe = R.roasted(n, "a quantidade culinária indicada no rótulo");
    if (num === 208)
      c.recipe = recipe(
        "Compota rápida de pera com cravo",
        ["2 peras em cubos", "2 cravos-da-índia", "100 ml de água"],
        [
          "Cozinhe os ingredientes em fogo baixo até a fruta amaciar.",
          "Retire os cravos inteiros antes de servir.",
        ],
        20,
      );
    if (num === 374)
      c.recipe = recipe(
        "Feijão aromatizado com louro",
        [
          "2 xícaras de feijão já completamente cozido",
          "1 folha de louro",
          "1/2 cebola picada",
          "1 colher de chá de azeite",
          "Água e sal conforme necessário",
        ],
        [
          "Refogue a cebola no azeite.",
          "Junte o feijão cozido, a folha de louro e um pouco de água e ferva por 10 minutos.",
          "Retire a folha antes de servir.",
        ],
        15,
      );
  }
  if (f === "coconutMilk")
    Object.assign(c, {
      description:
        "Leite de coco em pó é um ingrediente para reconstituir e dar sabor de coco a bebidas, cremes e molhos. A formulação pode incluir outros ingredientes além do coco.",
      highlights: [
        "Praticidade para dosar o sabor de coco",
        "Pode compor receitas doces ou salgadas",
        "Apresentação seca facilita o fracionamento",
      ],
      usage:
        "Reconstitua seguindo a proporção de água indicada pelo fabricante. Acrescente aos poucos para evitar grumos.",
      allergens:
        "Algumas formulações podem conter derivados de leite, soja ou outros componentes. " +
        allergen,
      recipe: recipe(
        "Creme de banana com leite de coco",
        [
          "2 bananas maduras",
          "Leite de coco em pó na quantidade indicada para 150 ml de bebida reconstituída",
          "150 ml de água potável",
          "Canela a gosto",
        ],
        [
          "Reconstitua o leite de coco conforme o rótulo.",
          "Bata com as bananas e sirva com uma pequena pitada de canela.",
        ],
        8,
      ),
    });
  if (f === "sweetener")
    Object.assign(c, {
      description: `${n} é um ingrediente para adoçar, com poder de dulçor e recomendações que dependem da formulação. A equivalência com açúcar não deve ser presumida apenas pelo nome.`,
      highlights: [
        "Permite ajustar o dulçor de preparações",
        "Pode ser dosado conforme o rótulo",
        "Ajuda a adaptar uma receita ao ingrediente escolhido",
      ],
      usage:
        "Siga a equivalência e as restrições do fabricante. Produtos com o mesmo nome podem ter concentrações diferentes.",
      notes:
        num === 181
          ? [
              "O consumo excessivo de polióis pode causar desconforto intestinal.",
            ]
          : [
              "Confira se é um adoçante puro ou uma mistura antes de calcular a quantidade.",
            ],
      recipe: recipe(
        `Iogurte com fruta e ${low}`,
        [
          "1 pote de iogurte natural",
          "1/2 banana amassada",
          `${n}: quantidade equivalente a até 1 colher de chá de açúcar, conforme rótulo`,
        ],
        [
          "Misture o iogurte e a banana.",
          "Prove antes de adoçar e, se necessário, acrescente aos poucos a quantidade indicada pelo fabricante.",
        ],
        5,
        "1 porção",
      ),
      sources: [sources.guide],
    });
  if (f === "gelatin")
    Object.assign(c, {
      description:
        "Gelatina pura é usada para estruturar sobremesas e preparações que precisam firmar depois de refrigeradas. Confirme se o produto é gelatina não saborizada própria para alimentos e seu poder de gelificação.",
      highlights: [
        "Ajuda a firmar preparações refrigeradas",
        "Pode compor sobremesas com sucos e frutas",
        "Permite ajustar textura conforme a receita",
      ],
      usage:
        "Hidrate e dissolva conforme a embalagem, sem ferver depois da hidratação. A quantidade depende da formulação e da textura desejada.",
      allergens:
        "Gelatina costuma ter origem animal; confirme a origem e eventuais componentes adicionais. " +
        allergen,
      recipe: recipe(
        "Gelatina de suco de uva",
        [
          "500 ml de suco de uva",
          "Gelatina pura não saborizada na quantidade indicada no rótulo para 500 ml",
        ],
        [
          "Hidrate a gelatina em parte do líquido, seguindo o fabricante.",
          "Dissolva sem deixar ferver e misture ao suco restante.",
          "Leve à geladeira até firmar; o tempo de preparo não inclui a refrigeração.",
        ],
        15,
        "4 porções",
      ),
    });
  if (f === "sugar")
    Object.assign(c, {
      description: `${n} é um ingrediente para conferir dulçor, cor e textura a receitas. Açúcares de diferentes cores e origens continuam contribuindo como açúcares na alimentação.`,
      highlights: [
        "Adoça e participa da textura da receita",
        "Pode ajudar na cor de massas e caldas",
        "Permite ajustar o sabor em pequenas quantidades",
      ],
      usage:
        "Meça a quantidade da receita e considere o açúcar dos demais ingredientes. A origem ou a cor não indica consumo sem limite.",
      recipe: recipe(
        `Maçã na frigideira com ${low}`,
        [
          "2 maçãs em cubos",
          `1 colher de chá de ${low}`,
          "2 colheres de sopa de água",
          "Canela a gosto",
        ],
        [
          "Aqueça a maçã com a água em fogo baixo.",
          "Acrescente o açúcar e mexa até a fruta amaciar e o líquido reduzir.",
        ],
        12,
      ),
      sources: [sources.guide],
    });
  if (f === "cornmeal")
    Object.assign(c, {
      description:
        "Fubá mimoso é um derivado de milho de moagem fina, tradicional em bolos, mingaus e preparações cozidas. Sua textura muda com a proporção de líquido e o tempo de cocção.",
      highlights: [
        "Moagem fina para preparações de milho",
        "Versátil em receitas doces e salgadas",
        "Ajuda a dar consistência quando cozido",
      ],
      usage:
        "Cozinhe completamente as preparações e ajuste os líquidos para a textura desejada. Confira contaminação cruzada se houver restrição a glúten.",
      recipe: recipe(
        "Mingau de fubá",
        [
          "2 colheres de sopa de fubá",
          "300 ml de leite ou bebida vegetal",
          "Açúcar e canela a gosto",
        ],
        [
          "Dissolva o fubá em parte do líquido frio.",
          "Acrescente o restante e cozinhe em fogo baixo por 12 a 15 minutos, mexendo, até ficar bem cozido.",
          "Ajuste a consistência com mais líquido, se necessário.",
        ],
        20,
        "1 porção",
      ),
    });
  if (f === "crumb")
    Object.assign(c, {
      description: `${n} tem granulação que ajuda a dar textura a empanados, farofas ou coberturas. Use de acordo com a matéria-prima: produtos de milho, mandioca e trigo não se comportam de forma idêntica.`,
      highlights: [
        "Acrescenta textura e crocância após preparo",
        "Permite variar empanados e farofas",
        "Granulação influencia o resultado final",
      ],
      usage:
        "Use em receita adequada à farinha escolhida. Empanados devem cozinhar completamente; mantenha separados os utensílios que tocaram alimentos crus.",
      allergens: [312, 315].includes(num)
        ? "Pode conter trigo e glúten conforme a formulação. " + allergen
        : allergen,
      recipe: recipe(
        `Legumes de forno empanados com ${low}`,
        [
          "1 abobrinha em palitos",
          "1 ovo batido",
          `1/2 xícara de ${low}`,
          "1 colher de sopa de azeite",
          "Ervas a gosto",
        ],
        [
          "Passe os palitos no ovo e depois na farinha, sem reutilizar sobras que tocaram o ovo cru.",
          "Arrume em assadeira, regue com azeite e asse a 200 °C por cerca de 25 minutos, até cozinhar e dourar.",
        ],
        35,
      ),
    });
  if (f === "cornCoffee")
    Object.assign(c, {
      description:
        "Café de milho é uma preparação à base de milho para bebida. A intensidade, a moagem e a eventual mistura com outros ingredientes devem ser conferidas na embalagem.",
      highlights: [
        "Sabor tostado para variar bebidas quentes",
        "Pode acompanhar o café da manhã ou uma pausa",
        "Preparo ajustável à moagem do produto",
      ],
      usage:
        "Solicite à loja o modo de preparo do fabricante. Não presuma ausência de cafeína sem conferir se existe mistura com café ou outros ingredientes.",
      recipe: recipe(
        "Bebida de milho com canela",
        [
          "Café de milho: quantidade indicada para 250 ml de bebida",
          "250 ml de água potável",
          "1 pequeno pedaço de canela em pau, opcional",
        ],
        [
          "Prepare a bebida pelo método de extração e proporção indicados na embalagem.",
          "Se desejar, aqueça com um pequeno pedaço de canela e retire-o antes de servir.",
        ],
        10,
        "1 xícara",
      ),
      sources: [sources.guide],
    });
  if (f === "maca")
    Object.assign(c, {
      description:
        "Maca peruana em apresentação alimentar é um ingrediente de raiz usado para variar o sabor de preparações. Confirme que o lote é identificado como farinha ou alimento, sua composição e seu modo de uso.",
      highlights: [
        "Sabor característico para variar massas e preparações",
        "Pode ser incorporada a receitas quando rotulada para alimentação",
        "Porção e finalidade devem ser confirmadas no lote",
      ],
      usage:
        "Utilize em receita somente se o produto for identificado para uso alimentar e respeitando o rótulo. Não use como promessa de energia, aumento de libido ou tratamento.",
      notes: [
        "Se a apresentação for de suplemento, siga apenas as orientações e restrições de sua rotulagem.",
      ],
      recipe: R.pancake(n),
      sources: [sources.guide, sources.supplement],
    });
  if (f === "appleFiber")
    Object.assign(c, {
      description:
        "Fibra de maçã é um ingrediente processado a partir da fruta, usado para alterar a textura e complementar formulações alimentares. Confirme a composição e a indicação do lote.",
      highlights: [
        "Ingrediente associado às fibras da matéria-prima",
        "Pode mudar a retenção de umidade de massas",
        "Útil para testar pequenas adições a preparações",
      ],
      usage:
        "Use apenas a versão indicada para alimentos, na quantidade do fabricante. Acrescente líquido conforme a textura e evite ingerir o pó seco.",
      recipe: R.pancake(n),
    });
  if (f === "fenugreek")
    Object.assign(c, {
      description:
        "Feno-grego é uma especiaria de sementes com sabor intenso e levemente amargo. Seu uso culinário é diferente de preparações concentradas ou suplementares.",
      highlights: [
        "Aroma próprio para combinar com outras especiarias",
        "Sabor que pode variar legumes e molhos",
        "Pode ser usado em pequenas quantidades culinárias",
      ],
      usage:
        "Confirme se o lote é especiaria alimentar. Moa ou prepare conforme a receita e use em pequenas quantidades; não atribua finalidade hormonal ou terapêutica.",
      recipe: R.roasted("feno-grego moído", "1 pequena pitada"),
      sources: [sources.herbs],
    });
  if (f === "herbal")
    Object.assign(c, {
      kind: "herbal",
      description: `${n} é um material botânico que precisa ser identificado pela espécie, parte vegetal e finalidade do lote. Nomes populares podem se referir a plantas diferentes e não permitem definir uma indicação ou uma dose segura.`,
      highlights: [
        "Identificação botânica e procedência são essenciais",
        "A parte da planta determina a finalidade",
        "Orientações devem respeitar a rotulagem e o contexto individual",
      ],
      usage:
        "Confirme com a loja a espécie, a parte vegetal e a classificação do produto. Para finalidade medicinal ou uso de extratos, procure orientação profissional; não prepare doses a partir desta ficha.",
      notes: [
        "Não foi associada promessa de emagrecimento, tratamento, efeito calmante ou cura.",
        "Gestantes, lactantes, crianças e pessoas que usam medicamentos devem confirmar a adequação com profissional de saúde.",
      ],
      sources: [sources.plant, sources.herbs],
    });
  if (f === "grain")
    Object.assign(c, {
      description: `${n} é um ingrediente de grãos para variar acompanhamentos e preparações salgadas. A presença de partes integrais e a mistura de grãos dependem da apresentação específica.`,
      highlights: [
        "Base para compor acompanhamentos e refeições",
        "Combina com vegetais e leguminosas",
        "Pode ser temperado de acordo com a preparação",
      ],
      usage:
        "Lave quando indicado e cozinhe com água conforme a embalagem. Grãos integrais e misturas podem exigir mais líquido e tempo do que arroz branco.",
      allergens: [217, 237, 298].includes(num)
        ? "Contém derivado de cevada ou trigo, com glúten. " + allergen
        : allergen,
      recipe: R.salad(n),
    });
  if (f === "soyPowder")
    Object.assign(c, {
      description:
        "Extrato de soja natural é um ingrediente para reconstituir bebidas e compor receitas. Confira a formulação, porque extratos de diferentes fabricantes podem ter açúcar e aditivos distintos.",
      highlights: [
        "Ingrediente de base vegetal para receitas",
        "Pode compor bebidas e preparações cremosas",
        "Permite dosar a porção conforme a receita",
      ],
      usage:
        "Reconstitua com água potável segundo a embalagem. Não substitui automaticamente fórmulas infantis, leite materno ou alimentação prescrita.",
      allergens: "Contém soja. " + allergen,
      recipe: recipe(
        "Vitamina de banana com bebida de soja",
        [
          "1 banana",
          "200 ml de bebida de soja reconstituída conforme o rótulo",
          "Canela a gosto",
        ],
        [
          "Prepare o extrato na proporção indicada para 200 ml.",
          "Bata com a banana e sirva em seguida.",
        ],
        5,
        "1 porção",
      ),
      sources: [sources.soy, sources.guide],
    });
  if (f === "yeast")
    Object.assign(c, {
      description:
        "Levedo de cerveja em pó é um derivado de leveduras, diferente do fermento biológico ativo usado para fazer pão crescer. Sua composição e finalidade dependem do processamento e do rótulo.",
      highlights: [
        "Sabor característico em pequenas adições culinárias",
        "Não deve ser confundido com fermento de panificação",
        "Composição e uso alimentar precisam ser confirmados",
      ],
      usage:
        "Confirme se o lote é indicado como ingrediente de uso alimentar e use a porção do fabricante. Não use como fermento para crescimento de massas.",
      recipe: R.roasted(n, "1 pequena quantidade culinária conforme rótulo"),
      notes: [
        "Versões com uso suplementar devem seguir a orientação específica do fabricante.",
      ],
      sources: [sources.supplement, sources.guide],
    });
  if (f === "msg")
    Object.assign(c, {
      description:
        "Glutamato monossódico é um realçador de sabor associado ao umami. É usado em pequenas quantidades para complementar temperos de preparações salgadas.",
      highlights: [
        "Realça o perfil umami de alimentos salgados",
        "Pequenas quantidades permitem ajustar o sabor",
        "Combina com caldos, legumes e refogados",
      ],
      usage:
        "Siga a indicação do fabricante e considere o sódio do conjunto da refeição. Não substitua uma restrição de sódio sem orientação.",
      recipe: R.roasted(n, "1 pequena pitada"),
      sources: [sources.guide],
    });
  if (f === "pasta")
    Object.assign(c, {
      description: `${n} oferece um formato de massa para refeições com molhos e legumes. O tempo de cozimento e a composição variam conforme a base de arroz, trigo ou misturas.`,
      highlights: [
        "Formato adequado para envolver molhos",
        "Prático para refeições quentes ou saladas de massa",
        "Permite combinar diferentes vegetais",
      ],
      usage:
        "Cozinhe em água conforme o tempo da embalagem, escorra e incorpore ao molho. Massas de arroz não significam ausência garantida de glúten por contaminação cruzada.",
      allergens: /integral/i.test(n)
        ? "Confirme se a massa integral é de trigo; nesse caso contém trigo e glúten. " +
          allergen
        : allergen,
      recipe: recipe(
        `Salada de ${low}`,
        [
          `160 g de ${low}`,
          "1 tomate picado",
          "1/2 cenoura ralada",
          "1 colher de sopa de azeite",
          "Ervas e limão a gosto",
        ],
        [
          "Cozinhe a massa conforme a embalagem e escorra.",
          "Deixe amornar e misture aos vegetais higienizados.",
          "Tempere com azeite, ervas e limão e sirva.",
        ],
        25,
      ),
    });
  if (f === "gingerPowder")
    Object.assign(c, {
      description:
        "Gengibre em pó é uma especiaria de aroma intenso e sabor picante. A apresentação seca facilita incorporar pequenas quantidades a massas, molhos e preparações com frutas.",
      highlights: [
        "Aroma intenso em pequena quantidade",
        "Combina com receitas doces e salgadas",
        "Apresentação em pó distribui sabor na massa",
      ],
      usage:
        "Acrescente aos poucos e prove. A quantidade de pó não equivale ao mesmo volume de gengibre fresco.",
      recipe: recipe(
        "Panqueca de banana com gengibre",
        [
          "1 banana amassada",
          "1 ovo",
          "2 colheres de sopa de farinha de aveia",
          "1 pequena pitada de gengibre em pó",
          "2 colheres de sopa de água",
        ],
        [
          "Misture os ingredientes até formar uma massa homogênea.",
          "Prepare discos pequenos em frigideira untada, em fogo baixo, dos dois lados até cozinhar o centro.",
        ],
        15,
      ),
      sources: [sources.herbs, sources.guide],
    });
  if (f === "guarana")
    Object.assign(c, {
      kind: "supplement",
      description:
        "Guaraná em pó é um ingrediente com cafeína, cuja concentração pode variar. A finalidade, a porção e as restrições do produto precisam ser conferidas na rotulagem do lote.",
      highlights: [
        "Possui cafeína naturalmente na matéria-prima",
        "Concentração e porção variam conforme o produto",
        "Rótulo é necessário para definir a forma de uso",
      ],
      usage:
        "Solicite as informações do fabricante e siga a finalidade, a porção e as restrições do rótulo. Evite somar fontes de cafeína sem considerar a quantidade total.",
      notes: [
        "Pessoas sensíveis à cafeína, gestantes, lactantes e crianças precisam confirmar a adequação com orientação de saúde.",
        "Não foi indicada receita ou quantidade de cafeína sem a rotulagem do lote.",
      ],
      sources: [sources.supplement],
    });
  if (f === "snack")
    Object.assign(c, {
      description: `${n} é uma opção para servir em pequenas porções ou acrescentar textura a acompanhamentos. A composição, o sal, o açúcar e o modo de preparo variam conforme a apresentação.`,
      highlights: [
        "Textura crocante para complementar a apresentação",
        "Praticidade para porcionar",
        "Pode compor pequenos acompanhamentos",
      ],
      usage:
        "Confira se o produto está pronto para consumo e os ingredientes da cobertura. Adicione somente ao servir para preservar a textura.",
      allergens:
        "Salgadinhos e biscoitos podem levar trigo, leite, ovos, soja ou outros ingredientes de cobertura. " +
        allergen,
      recipe: /canela|leite|amendoim/i.test(n)
        ? R.dessert(n)
        : recipe(
            `Salada crocante com ${low}`,
            [
              "2 xícaras de folhas e legumes higienizados",
              "1 tomate picado",
              `2 colheres de sopa de ${low} pronto para consumo`,
              "Azeite e limão a gosto",
            ],
            [
              "Misture os vegetais e tempere.",
              "Acrescente uma pequena quantidade do ingrediente crocante apenas na hora de servir.",
            ],
            8,
          ),
      sources: [sources.guide],
    });
  if (f === "soyProtein")
    Object.assign(c, {
      description: `${n} é proteína vegetal texturizada de soja em pequenos pedaços. Depois de hidratada, pode ser temperada para molhos, refogados e recheios.`,
      highlights: [
        "Contém proteína de origem vegetal",
        "Absorve temperos durante o preparo",
        "Textura útil em recheios e molhos",
      ],
      usage:
        "Hidrate e prepare segundo a embalagem. Escorra e esprema quando indicado, depois cozinhe ou refogue até finalizar a preparação.",
      allergens: "Contém soja. " + allergen,
      recipe: recipe(
        "Molho de tomate com proteína de soja",
        [
          `1 xícara de ${low}`,
          "1 xícara de molho de tomate",
          "1/2 cebola picada",
          "1 dente de alho",
          "1 colher de sopa de azeite",
          "Água conforme a embalagem",
        ],
        [
          "Hidrate a proteína conforme as instruções, escorra e esprema se indicado.",
          "Refogue a cebola e o alho no azeite, junte a proteína e mexa por alguns minutos.",
          "Acrescente o molho e um pouco de água e cozinhe até finalizar e incorporar os sabores.",
        ],
        25,
      ),
      sources: [sources.soy],
    });
  if (f === "granulatedTapioca")
    Object.assign(c, {
      description:
        "Tapioca granulada fina é um derivado seco de mandioca, diferente da goma já hidratada de frigideira. Ela precisa hidratar para ganhar a textura adequada à receita.",
      highlights: [
        "Grânulos absorvem líquido durante o preparo",
        "Pode compor pudins e preparações cremosas",
        "Permite criar textura diferente da tapioca de frigideira",
      ],
      usage:
        "Use em receita específica para tapioca granulada. Hidrate com o líquido e tempo recomendados; não tente substituir diretamente por goma hidratada.",
      recipe: recipe(
        "Tapioca granulada cremosa",
        [
          "1/2 xícara de tapioca granulada",
          "400 ml de leite ou bebida vegetal",
          "2 colheres de sopa de coco ralado",
          "Açúcar a gosto, se necessário",
        ],
        [
          "Aqueça o líquido até ficar bem quente.",
          "Misture à tapioca numa tigela e deixe hidratar conforme a embalagem, mexendo de vez em quando; acrescente mais líquido se necessário.",
          "Junte o coco e sirva na textura desejada; respeite as condições de conservação da preparação.",
        ],
        35,
        "3 porções",
      ),
    });
  if (f === "cornFlakeCooking")
    Object.assign(c, {
      description:
        "Flocão de milho é uma apresentação em flocos maiores, usada tradicionalmente para cuscuz. Ele precisa hidratar e passar por cocção para ficar macio.",
      highlights: [
        "Base tradicional para cuscuz",
        "Textura adequada ao cozimento no vapor",
        "Combina com acompanhamentos doces ou salgados",
      ],
      usage:
        "Hidrate com água e cozinhe no vapor segundo a embalagem. Não é o mesmo produto que cereal matinal pronto para consumo.",
      recipe: recipe(
        "Cuscuz de milho simples",
        [
          "1 xícara de flocão de milho",
          "Cerca de 1/2 xícara de água, ajustando conforme o rótulo",
          "1 pitada de sal",
        ],
        [
          "Misture o flocão, o sal e a água e deixe hidratar por 10 minutos.",
          "Coloque na cuscuzeira sem compactar e cozinhe no vapor por cerca de 10 a 15 minutos, até ficar macio.",
        ],
        30,
      ),
    });
  if (f === "bulgur")
    Object.assign(c, {
      description:
        "Trigo para quibe é trigo preparado em grânulos para hidratar e usar em saladas, recheios e quibes. A granulação e a formulação orientam o tempo de hidratação.",
      highlights: [
        "Textura característica em tabule e quibe",
        "Absorve temperos após hidratação",
        "Combina com vegetais e ervas",
      ],
      usage:
        "Hidrate conforme a embalagem e escorra ou esprema quando necessário. Receitas com carnes devem passar por cocção segura; a sugestão desta ficha é sem carne.",
      allergens: "Contém trigo e glúten. " + allergen,
      recipe: recipe(
        "Tabule com trigo para quibe",
        [
          "1/2 xícara de trigo para quibe",
          "1 tomate picado",
          "1/2 pepino picado",
          "Salsinha e hortelã a gosto",
          "1 colher de sopa de azeite",
          "Suco de 1/2 limão",
        ],
        [
          "Hidrate o trigo segundo o rótulo e escorra bem.",
          "Misture os vegetais e ervas higienizados.",
          "Tempere com azeite e limão e sirva.",
        ],
        30,
      ),
    });
  if (f === "popcorn")
    Object.assign(c, {
      description:
        "Milho para pipoca é o grão apropriado para estourar por aquecimento. Permite preparar a porção e ajustar o óleo, o sal ou outros temperos na cozinha.",
      highlights: [
        "Pode ser preparado na quantidade desejada",
        "Permite controlar o tempero adicionado",
        "Textura crocante depois do preparo",
      ],
      usage:
        "Use recipiente apropriado e siga o método de preparo seguro. Descarte grãos não estourados ao servir.",
      recipe: recipe(
        "Pipoca com ervas",
        [
          "1/3 de xícara de milho para pipoca",
          "1 colher de chá de óleo",
          "Ervas secas e sal a gosto",
        ],
        [
          "Aqueça o óleo em panela adequada, adicione o milho e tampe.",
          "Mantenha em fogo moderado, movimentando com cuidado até os estouros espaçarem.",
          "Desligue, espere parar e tempere. Retire os grãos não estourados.",
        ],
        12,
        "3 porções",
      ),
    });
  if (f === "hominy")
    Object.assign(c, {
      description: `${n} é um derivado de milho para preparações cozidas. A granulação e o tipo de milho influenciam o tempo e a quantidade de líquido necessários.`,
      highlights: [
        "Base de milho para preparações tradicionais",
        "Pode compor receitas doces ou salgadas",
        "Textura ajustável ao tempo e ao líquido de cocção",
      ],
      usage:
        "Faça o preparo, eventual remolho e cozimento completo conforme a embalagem. Ajuste a receita à granulação, sem substituir derivados diferentes automaticamente.",
      recipe: recipe(
        `Caldo salgado com ${low}`,
        [
          `1 xícara de ${low} já completamente cozido`,
          "500 ml de caldo caseiro de legumes",
          "1/2 cebola picada",
          "1 colher de chá de azeite",
          "Ervas a gosto",
        ],
        [
          "Refogue a cebola no azeite.",
          "Junte o milho previamente cozido e o caldo e cozinhe por cerca de 10 minutos.",
          "Ajuste a textura com líquido e finalize com ervas. O tempo não inclui remolho ou cocção inicial.",
        ],
        15,
      ),
    });
  if (f === "potatoFlakes")
    Object.assign(c, {
      description:
        "Purê de batata em flocos é um ingrediente seco para reconstituir. O líquido, a textura final e os ingredientes adicionais dependem da formulação do fabricante.",
      highlights: [
        "Reconstituição prática conforme o rótulo",
        "Pode compor acompanhamentos cremosos",
        "Facilita fracionar a quantidade de preparo",
      ],
      usage:
        "Siga as proporções de líquido e demais ingredientes indicadas pelo fabricante. Confira se a mistura já contém sal ou leite.",
      allergens:
        "Pode conter leite e outros ingredientes, conforme a formulação. " +
        allergen,
      recipe: recipe(
        "Purê com ervas",
        [
          "Flocos de batata na porção indicada para 2 pessoas",
          "Líquido e demais ingredientes nas proporções do rótulo",
          "Salsinha picada a gosto",
        ],
        [
          "Prepare o purê seguindo o fabricante.",
          "Ajuste a consistência com o líquido indicado, mexendo sem compactar demais.",
          "Finalize com salsinha higienizada.",
        ],
        12,
      ),
    });
  if (f === "cereal")
    Object.assign(c, {
      description: `${n} é ${[365, 366, 367].includes(num) ? "um cereal em flocos de milho" : "uma opção de cereal para montar tigelas e lanches"}. ${num === 365 ? "Corn Sugar indica flocos de milho com açúcar, não açúcar puro." : num === 366 ? "A versão mascavo utiliza açúcar mascavo no cereal; não é açúcar mascavo puro." : "Confira a composição, a presença de açúcar, os ingredientes da mistura e o modo de consumo."}`,
      highlights: [
        "Textura pronta para montar tigelas e lanches",
        "Combina com iogurte, leite ou frutas",
        "Facilita porcionar a quantidade desejada",
      ],
      usage:
        "Confirme se o cereal está pronto para consumo e adicione ao líquido ou à fruta apenas ao servir. A expressão “sem açúcar” precisa ser conferida na rotulagem e não elimina açúcares dos ingredientes.",
      allergens:
        "Cereais e granolas podem conter trigo, aveia, cevada, soja, leite, amendoim e castanhas. " +
        allergen,
      recipe: R.bowl(n),
      sources: [
        sources.guide,
        ...(num === 365
          ? [sources.corn]
          : num === 366
            ? [sources.cornBrown]
            : []),
      ],
    });
  if (f === "tapiocaGum")
    Object.assign(c, {
      description:
        "Goma do Norte é uma denominação comercial de derivado de mandioca. Confirme se o lote é goma hidratada pronta para frigideira ou outro tipo de fécula antes de escolher a receita.",
      highlights: [
        "Base de mandioca para preparações tradicionais",
        "Pode compor uma tapioca quando for goma hidratada",
        "A apresentação determina a forma de preparo",
      ],
      usage:
        "Use a receita abaixo apenas para goma hidratada própria para frigideira. Se o lote for fécula seca, solicite o preparo correto à loja.",
      recipe: recipe(
        "Tapioca de banana com goma hidratada",
        [
          "3 colheres de sopa de goma hidratada própria para frigideira",
          "1 banana em rodelas",
          "Canela a gosto",
        ],
        [
          "Distribua uma camada fina de goma peneirada numa frigideira adequada.",
          "Aqueça até a massa unir e firmar, seguindo o preparo do fabricante.",
          "Acrescente banana e uma pitada de canela e dobre.",
        ],
        10,
        "1 unidade",
      ),
    });
  if (f === "starch")
    Object.assign(c, {
      description: `${n} é um amido usado para alterar textura e estrutura de preparações cozidas ou assadas. Polvilho doce, azedo e fécula de batata possuem aplicações diferentes.`,
      highlights: [
        "Ajuda a dar estrutura ou espessar receitas",
        "Pode variar a textura de massas",
        "Deve ser escolhido de acordo com a preparação",
      ],
      usage:
        "Siga uma receita específica para o amido escolhido e cozinhe completamente. Em líquidos, disperse antes em uma pequena parte fria para evitar grumos.",
      recipe:
        num === 357
          ? recipe(
              "Creme de legumes com fécula de batata",
              [
                "2 xícaras de legumes cozidos batidos com 300 ml de água",
                "1 colher de chá de fécula de batata",
                "2 colheres de sopa de água fria",
                "Ervas a gosto",
              ],
              [
                "Aqueça o creme de legumes.",
                "Dissolva a fécula na água fria e acrescente aos poucos, mexendo até cozinhar e engrossar.",
              ],
              12,
            )
          : recipe(
              `Biscoitinhos de frigideira com ${low}`,
              [
                "1 ovo",
                `3 colheres de sopa de ${low}`,
                "1 colher de sopa de água",
                "1 colher de chá de azeite",
                "1 pitada de sal",
              ],
              [
                "Misture todos os ingredientes; ajuste com pequenas adições de água até obter massa espessa.",
                "Coloque pequenas porções em frigideira antiaderente levemente untada.",
                "Cozinhe em fogo baixo dos dois lados, até o centro estar completamente cozido.",
              ],
              15,
            ),
    });
  if (f === "oatWheat")
    Object.assign(c, {
      description: `${n} é um derivado de cereal para variar massas, mingaus e outras preparações. Flocos, farelos e farinhas apresentam absorção de líquido e textura diferentes.`,
      highlights: [
        "Contém os componentes vegetais do cereal",
        "Textura útil em preparações cozidas",
        "Pode complementar massas e pequenos lanches",
      ],
      usage:
        "Use em receita adequada ao formato e cozinhe quando indicado. Ajuste o líquido para evitar massa seca; não troque farelo por farinha automaticamente.",
      allergens:
        num === 363
          ? "Contém trigo e glúten. " + allergen
          : "Aveia pode apresentar contaminação por cereais com glúten; confirme o rótulo. " +
            allergen,
      recipe: num === 363 ? R.pancake(n) : R.oats(n),
    });
  if (f === "bakingSoda")
    Object.assign(c, {
      description:
        "Bicarbonato de sódio de grau alimentício é um ingrediente culinário usado em pequenas quantidades, conforme a receita. Não é equivalente a fermento químico composto nem deve ser vendido como tratamento.",
      highlights: [
        "Pode participar do crescimento de massas com componente ácido",
        "É dosado em pequenas quantidades culinárias",
        "A classificação alimentícia deve ser confirmada no lote",
      ],
      usage:
        "Confirme o grau alimentício e use apenas a quantidade pedida numa receita. Não ingira para tratar sintomas e não confunda com mistura de fermento.",
      recipe: recipe(
        "Panquecas com iogurte e bicarbonato",
        [
          "1 ovo",
          "1/2 xícara de iogurte natural",
          "1/2 xícara de farinha de trigo",
          "1/8 de colher de chá de bicarbonato alimentício",
          "Óleo para untar",
        ],
        [
          "Misture ovo e iogurte e incorpore a farinha.",
          "Acrescente a pequena quantidade de bicarbonato e misture brevemente.",
          "Prepare discos pequenos em frigideira untada, em fogo baixo, dos dois lados até o centro ficar cozido.",
        ],
        15,
      ),
      sources: [sources.guide],
    });
  if (f === "tea")
    Object.assign(c, {
      description: `${n} pode compor uma bebida quando a espécie, a parte vegetal e a apresentação forem identificadas para uso alimentar. O preparo destaca aroma e sabor sem atribuir à bebida uma finalidade de tratamento.`,
      highlights: [
        "Aroma e sabor para uma pausa no dia",
        "Pode ser servido conforme o preparo indicado no rótulo",
        "Permite variar bebidas sem depender de açúcar",
      ],
      usage:
        "Confirme a espécie e a parte vegetal do lote e siga o modo de preparo, a quantidade e o tempo indicados pelo fabricante. Para finalidade medicinal, procure orientação adequada.",
      notes: [
        num === 371 || num === 389 || num === 390 || num === 392
          ? "Chás de Camellia sinensis e erva-mate contêm cafeína; considere a sensibilidade individual e as demais fontes da dieta."
          : "A adequação individual e o uso junto a medicamentos devem ser conferidos quando necessário.",
      ],
      recipe: R.infusion(n),
      sources: [sources.herbs, sources.plant],
    });
  if (f === "ora")
    Object.assign(c, {
      description:
        "Ora-pro-nóbis é uma hortaliça de uso culinário quando corretamente identificada. A espécie e a apresentação do lote precisam ser confirmadas; folhas alimentícias não devem ser confundidas com suplementos em cápsulas.",
      highlights: [
        "Pode compor preparações com hortaliças e ovos",
        "Acrescenta cor e textura às receitas",
        "Tem uso culinário documentado em publicações da Embrapa",
      ],
      usage:
        "Use apenas folhas alimentícias corretamente identificadas. Confira se o lote é fresco, desidratado ou em pó e adapte o preparo indicado pela loja.",
      recipe: recipe(
        "Omelete com ora-pro-nóbis",
        [
          "2 ovos",
          "Folhas alimentícias de ora-pro-nóbis: 1 colher de sopa se desidratadas, ou 1 pequeno punhado fresco",
          "1 colher de sopa de água",
          "1 colher de chá de azeite",
          "Sal a gosto",
        ],
        [
          "Seque as folhas higienizadas ou hidrate a versão seca conforme a embalagem.",
          "Refogue brevemente as folhas no azeite.",
          "Bata os ovos com água e uma pitada de sal, junte às folhas e cozinhe dos dois lados, até os ovos estarem bem cozidos.",
        ],
        15,
      ),
      sources: [sources.ora, sources.tbca],
    });
  if (f === "cheese")
    Object.assign(c, {
      description:
        "Queijo parmesão é um queijo de sabor marcante, usado para finalizar massas, legumes e outras receitas. A apresentação ralada, em lascas ou em peça e as condições de conservação devem ser confirmadas no lote.",
      highlights: [
        "Sabor intenso para finalizar pequenas porções",
        "Pode acrescentar textura após gratinar",
        "Combina com massas e legumes",
      ],
      usage:
        "Use na finalização ou para gratinar em receita apropriada. Considere o sal do queijo ao temperar a preparação.",
      storage:
        "Conserve na temperatura e pelo prazo indicados pelo fabricante. Confirme com a loja as exigências de refrigeração para o lote e a apresentação vendidos.",
      allergens:
        "Contém leite e pode conter outros componentes segundo a formulação. " +
        allergen,
      recipe: recipe(
        "Legumes gratinados com parmesão",
        [
          "2 xícaras de legumes já cozidos",
          "2 colheres de sopa de queijo parmesão",
          "1 colher de chá de azeite",
          "Ervas a gosto",
        ],
        [
          "Coloque os legumes cozidos num refratário.",
          "Regue com azeite e finalize com o parmesão e as ervas.",
          "Leve ao forno a 200 °C por cerca de 10 minutos para gratinar.",
        ],
        20,
      ),
    });
  if (num === 270) {
    c.highlights = [
      "Sabor suave que combina com preparações cremosas",
      "Traz gorduras e proteína vegetal da castanha",
      "Versátil em receitas doces e salgadas",
    ];
    c.recipe = recipe(
      "Creme de castanha de caju",
      [
        "100 g de castanha de caju crua sem casca",
        "150 a 200 ml de água potável",
        "1 colher de chá de suco de limão",
        "1 pequena pitada de sal, opcional",
      ],
      [
        "Coloque as castanhas em água potável e ferva suavemente por cerca de 10 minutos para amaciar.",
        "Escorra, deixe amornar e bata com 150 ml de água, o limão e, se desejar, o sal.",
        "Acrescente água aos poucos até ficar cremoso. Use em molhos e mantenha o creme pronto refrigerado, em recipiente limpo.",
      ],
      20,
      "4 porções",
    );
  }
  if (num === 362) {
    c.highlights = [
      "Forma gel quando hidratada",
      "Acrescenta fibras próprias da semente",
      "Textura adequada a preparações cremosas",
    ];
    c.recipe = recipe(
      "Pudim de chia com banana",
      [
        "2 colheres de sopa de chia",
        "200 ml de leite ou bebida vegetal",
        "1 banana em rodelas",
      ],
      [
        "Misture a chia e o líquido num recipiente limpo.",
        "Mexa novamente depois de 10 minutos e leve à geladeira por pelo menos 2 horas, até hidratar e formar gel; não consuma sementes ainda secas.",
        "Acrescente a banana ao servir. O tempo informado não inclui o repouso refrigerado.",
      ],
      10,
      "2 porções",
    );
  }
  if (num === 96) {
    c.highlights = [
      "Grãos que ajudam a variar os acompanhamentos",
      "Contém componentes vegetais como proteína e fibras",
      "Textura delicada após o cozimento",
    ];
    c.recipe = recipe(
      "Quinua branca com legumes",
      [
        "1/2 xícara de quinua branca",
        "1 xícara de água, ajustando conforme o rótulo",
        "1/2 cenoura em cubinhos",
        "1/2 cebola picada",
        "1 colher de chá de azeite",
        "Ervas a gosto",
      ],
      [
        "Lave a quinua em peneira fina quando indicado pelo fabricante.",
        "Refogue a cebola e a cenoura no azeite; junte a quinua e a água.",
        "Cozinhe em fogo baixo até a água ser absorvida e os grãos e a cenoura ficarem macios, normalmente cerca de 15 a 20 minutos; acrescente água se necessário.",
      ],
      30,
      "2 porções",
    );
  }
  if (num === 266) {
    c.highlights = [
      "Metades de nozes para porcionar ou picar",
      "Traz gorduras e proteína vegetal da oleaginosa",
      "Crocância que combina com frutas e farofas",
    ];
    c.recipe = recipe(
      "Farofa de nozes com maçã",
      [
        "4 colheres de sopa de nozes picadas",
        "1/2 maçã em cubinhos",
        "1/2 xícara de farinha de mandioca",
        "1/2 cebola picada",
        "1 colher de sopa de azeite",
      ],
      [
        "Refogue a cebola no azeite e acrescente a maçã, deixando amaciar.",
        "Junte a farinha e mexa em fogo baixo por alguns minutos.",
        "Desligue e finalize com as nozes picadas.",
      ],
      20,
      "4 porções",
    );
  }
  if (!c.description || !c.usage || !c.highlights.length)
    throw Error(`Conteúdo incompleto: ${p.id} ${f}`);
  if (c.kind === "food" && !c.recipe) throw Error(`Receita ausente: ${p.id}`);
  profiles[p.id] = c;
}
await writeFile(
  new URL("../lib/product-content.json", import.meta.url),
  JSON.stringify(profiles, null, 2) + "\n",
);
await writeFile(
  new URL("../data/product-content-research.json", import.meta.url),
  JSON.stringify(
    {
      method:
        "Revisão por ingrediente e apresentação. Fontes institucionais para características gerais; receitas editoriais adaptadas. Composição do lote depende da identificação do fornecedor.",
      sources,
      products: catalog
        .filter((p) => p.isGranel)
        .map((p) => ({
          id: p.id,
          name: p.nome_produto,
          family: map[Number(p.id.split("-")[1])].family,
          kind: profiles[p.id].kind,
          recipe: profiles[p.id].recipe?.title || null,
          sourceUrls: profiles[p.id].sources.map((s) => s.url),
        })),
    },
    null,
    2,
  ) + "\n",
);
const categoryMap = {};
for (const p of catalog.filter((p) => p.isGranel)) {
  const n = Number(p.id.split("-")[1]),
    f = map[n].family;
  categoryMap[p.id] = ["external", "supplement", "guarana"].includes(f)
    ? "Cuidados e suplementos"
    : ["herbal", "tea"].includes(f)
      ? "Chás e ervas"
      : [
            "spice",
            "cinnamonPowder",
            "cinnamonStick",
            "fenugreek",
            "gingerPowder",
            "msg",
          ].includes(f)
        ? "Temperos"
        : ["nut"].includes(f)
          ? "Castanhas"
          : [361, 363].includes(n)
            ? "Farinhas e pós"
            : [
                  "smallGrain",
                  "seed",
                  "soyGrain",
                  "grain",
                  "legume",
                  "cereal",
                  "oatWheat",
                ].includes(f)
              ? "Grãos e sementes"
              : [
                    "specialFlour",
                    "nutFlour",
                    "psyllium",
                    "maca",
                    "appleFiber",
                    "yeast",
                    "cocoa",
                    "cornmeal",
                    "semolina",
                    "starch",
                    "crumb",
                    "granulatedTapioca",
                    "tapiocaGum",
                    "cornFlakeCooking",
                    "hibiscusPowder",
                  ].includes(f)
                ? "Farinhas e pós"
                : "Mercearia";
}
await writeFile(
  new URL("../lib/catalog-groups.json", import.meta.url),
  JSON.stringify(categoryMap, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    profiles: Object.keys(profiles).length,
    recipes: Object.values(profiles).filter((p) => p.recipe).length,
    orientationOnly: Object.values(profiles).filter((p) => !p.recipe).length,
  }),
);
