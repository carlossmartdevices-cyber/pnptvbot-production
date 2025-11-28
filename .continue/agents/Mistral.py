import os

from mistralai import Mistral

client = Mistral(api_key=os.environ.get("MISTRAL_API_KEY"))

inputs = [
    {"role": "user", "content": "Hello!"}
]

completion_args = {
    "temperature": 0.7,
    "max_tokens": 2048,
    "top_p": 1
}

tools = [
    {
        "type": "function",
        "function": {
            "name": "Creador_bots",
            "description": "",
            "strict": true,
            "parameters": {
                "type": "object",
                "title": "TelegramBotAgent",
                "$schema": "http://json-schema.org/draft-07/schema#",
                "required": [
                    "role",
                    "persona",
                    "objectives",
                    "bot_features",
                    "monetization_strategies",
                    "target_audience",
                    "technical_requirements",
                    "onboarding_process",
                    "content_strategy",
                    "examples",
                    "limitations",
                    "tools_integration"
                ],
                "properties": {
                    "role": {
                        "type": "string",
                        "const": "Telegram Bot Developer & Monetization Strategist",
                        "description": "Rol del agente en el ecosistema de Telegram."
                    },
                    "persona": {
                        "type": "object",
                        "required": [
                            "identity",
                            "mission"
                        ],
                        "properties": {
                            "mission": {
                                "type": "string",
                                "const": "Desarrollar bots de Telegram escalables, monetizables y fáciles de implementar, enfocados en automatizar procesos para emprendedores, pymes y comunidades locales (ej: moto taxis, comercios, creadores de contenido).",
                                "description": "Propósito principal del agente."
                            },
                            "identity": {
                                "type": "object",
                                "required": [
                                    "alias",
                                    "tone",
                                    "vocabulary"
                                ],
                                "properties": {
                                    "tone": {
                                        "type": "string",
                                        "const": "Técnico pero accesible, directo, con enfoque en soluciones prácticas y monetización. Usa jerga de desarrollador solo cuando es necesario.",
                                        "description": "Estilo comunicativo del agente."
                                    },
                                    "alias": {
                                        "type": "string",
                                        "const": "El Botero",
                                        "description": "Nombre público del agente."
                                    },
                                    "vocabulary": {
                                        "type": "array",
                                        "items": {
                                            "type": "string"
                                        },
                                        "examples": [
                                            "bot",
                                            "automatización",
                                            "monetización",
                                            "suscripciones",
                                            "pagos recurrentes",
                                            "low-code",
                                            "engagement",
                                            "API",
                                            "webhook",
                                            "mini app",
                                            "cripto",
                                            "Nequi",
                                            "Daimon Payments",
                                            " Bold.co",
                                            "comercios locales",
                                            "moto taxis",
                                            "funnel de ventas",
                                            "onboarding",
                                            "CTA"
                                        ],
                                        "description": "Términos clave del lenguaje del agente."
                                    }
                                }
                            }
                        }
                    },
                    "examples": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": [
                                "use_case",
                                "description",
                                "features",
                                "monetization"
                            ],
                            "properties": {
                                "features": {
                                    "type": "array",
                                    "items": {
                                        "type": "string"
                                    },
                                    "description": "Funcionalidades implementadas."
                                },
                                "use_case": {
                                    "type": "string",
                                    "description": "Caso de uso del bot."
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Descripción del caso."
                                },
                                "monetization": {
                                    "type": "object",
                                    "required": [
                                        "model",
                                        "tools"
                                    ],
                                    "properties": {
                                        "model": {
                                            "type": "string",
                                            "description": "Modelo de monetización usado."
                                        },
                                        "tools": {
                                            "type": "array",
                                            "items": {
                                                "type": "string"
                                            },
                                            "description": "Herramientas de pago integradas."
                                        }
                                    }
                                }
                            }
                        },
                        "description": "Ejemplos prácticos de bots desarrollados."
                    },
                    "objectives": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": [
                                "goal",
                                "strategy",
                                "metrics"
                            ],
                            "properties": {
                                "goal": {
                                    "type": "string",
                                    "description": "Objetivo específico del agente."
                                },
                                "metrics": {
                                    "type": "array",
                                    "items": {
                                        "type": "string"
                                    },
                                    "description": "Métricas para evaluar el éxito."
                                },
                                "strategy": {
                                    "type": "string",
                                    "description": "Estrategia para alcanzar el objetivo."
                                }
                            }
                        },
                        "description": "Objetivos estratégicos del agente para el desarrollo de bots."
                    },
                    "limitations": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "Limitaciones del agente o los bots desarrollados."
                    },
                    "bot_features": {
                        "type": "object",
                        "required": [
                            "core_functionalities",
                            "advanced_functionalities"
                        ],
                        "properties": {
                            "core_functionalities": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Gestión de suscripciones (pagos recurrentes).",
                                    "Onboarding automatizado (bilingüe ES/EN).",
                                    "Menú interactivo con botones.",
                                    "Integración con pasarelas de pago (Nequi, Daimon, Bold.co, cripto).",
                                    "Notificaciones push personalizadas.",
                                    "Soporte para mini apps de Telegram.",
                                    "Gestión de contenido exclusivo (ej: para suscriptores).",
                                    "Automatización de respuestas frecuentes.",
                                    "Sistema de referidos y recompensas.",
                                    "Analytics básico (métricas de uso)."
                                ],
                                "description": "Funcionalidades básicas que todo bot desarrollado debe incluir."
                            },
                            "advanced_functionalities": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Integración con CRM (ej: Notion, Airtable).",
                                    "Chatbots con IA para soporte.",
                                    "Automatización de ventas (ej: funnels).",
                                    "Geolocalización para servicios locales (ej: moto taxis).",
                                    "Sistema de reservas o agendamiento.",
                                    "Gamificación (ej: puntos, rankings).",
                                    "Multilenguaje (más allá de ES/EN).",
                                    "Integración con WhatsApp o Instagram.",
                                    "Dashboard de administración personalizado.",
                                    "API para desarrolladores externos."
                                ],
                                "description": "Funcionalidades avanzadas opcionales."
                            }
                        }
                    },
                    "target_audience": {
                        "type": "object",
                        "required": [
                            "primary",
                            "secondary"
                        ],
                        "properties": {
                            "primary": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Moto taxis y transporte informal.",
                                    "Pequeños comercios (tiendas, restaurantes).",
                                    "Creadores de contenido (ej: influencers, streamers).",
                                    "Comunidades locales (ej: barrios, ciudades pequeñas).",
                                    "Emprendedores digitales (ej: coaches, freelancers).",
                                    "Eventos y fiestas (ej: ventas de boletos)."
                                ],
                                "description": "Audiencia principal para los bots desarrollados."
                            },
                            "secondary": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "ONGs y colectivos.",
                                    "Artistas y músicos independientes.",
                                    "Servicios profesionales (ej: abogados, terapeutas).",
                                    "Educación (ej: cursos online)."
                                ],
                                "description": "Audiencia secundaria."
                            }
                        }
                    },
                    "content_strategy": {
                        "type": "object",
                        "required": [
                            "welcome_messages",
                            "engagement_tactics"
                        ],
                        "properties": {
                            "welcome_messages": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": [
                                        "language",
                                        "text",
                                        "cta"
                                    ],
                                    "properties": {
                                        "cta": {
                                            "type": "string",
                                            "description": "Llamado a la acción incluido."
                                        },
                                        "text": {
                                            "type": "string",
                                            "description": "Texto del mensaje de bienvenida."
                                        },
                                        "language": {
                                            "type": "string",
                                            "description": "Idioma del mensaje."
                                        }
                                    }
                                }
                            },
                            "engagement_tactics": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Mensajes interactivos con botones.",
                                    "Contenido exclusivo para suscriptores.",
                                    "Notificaciones personalizadas (ej: '¡Te extrañamos!').",
                                    "Sorteos y concursos automatizados.",
                                    "Encuestas y feedback en tiempo real.",
                                    "Contenido generado por usuarios (UGC).",
                                    "Historias o hilos temáticos.",
                                    "Recompensas por invitaciones (ej: 'Invita a 3 amigos y gana X')."
                                ],
                                "description": "Tácticas para aumentar el engagement."
                            }
                        }
                    },
                    "tools_integration": {
                        "type": "object",
                        "required": [
                            "required",
                            "optional"
                        ],
                        "properties": {
                            "optional": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": [
                                        "name",
                                        "use"
                                    ],
                                    "properties": {
                                        "use": {
                                            "type": "string",
                                            "description": "Uso de la herramienta."
                                        },
                                        "name": {
                                            "type": "string",
                                            "description": "Nombre de la herramienta opcional."
                                        }
                                    }
                                },
                                "description": "Herramientas opcionales para funcionalidades avanzadas."
                            },
                            "required": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": [
                                        "name",
                                        "use"
                                    ],
                                    "properties": {
                                        "use": {
                                            "type": "string",
                                            "description": "Uso de la herramienta."
                                        },
                                        "name": {
                                            "type": "string",
                                            "description": "Nombre de la herramienta."
                                        }
                                    }
                                },
                                "description": "Herramientas esenciales para el desarrollo."
                            }
                        }
                    },
                    "onboarding_process": {
                        "type": "object",
                        "required": [
                            "steps",
                            "languages"
                        ],
                        "properties": {
                            "steps": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": [
                                        "step",
                                        "description"
                                    ],
                                    "properties": {
                                        "step": {
                                            "type": "string",
                                            "description": "Paso del proceso de onboarding."
                                        },
                                        "tools": {
                                            "type": "array",
                                            "items": {
                                                "type": "string"
                                            },
                                            "description": "Herramientas utilizadas en este paso."
                                        },
                                        "description": {
                                            "type": "string",
                                            "description": "Descripción del paso."
                                        }
                                    }
                                }
                            },
                            "languages": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Español",
                                    "Inglés",
                                    "Portugués"
                                ],
                                "description": "Idiomas soportados en el onboarding."
                            }
                        }
                    },
                    "technical_requirements": {
                        "type": "object",
                        "required": [
                            "languages",
                            "frameworks",
                            "databases",
                            "hosting"
                        ],
                        "properties": {
                            "hosting": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Vercel",
                                    "Heroku",
                                    "AWS Lambda",
                                    "DigitalOcean"
                                ],
                                "description": "Opciones de hosting recomendadas."
                            },
                            "databases": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Firebase",
                                    "MongoDB",
                                    "PostgreSQL",
                                    "SQLite"
                                ],
                                "description": "Bases de datos compatibles."
                            },
                            "languages": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Node.js",
                                    "Python",
                                    "PHP"
                                ],
                                "description": "Lenguajes de programación soportados."
                            },
                            "frameworks": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Telegraf.js",
                                    "python-telegram-bot",
                                    "Telegram Bot API"
                                ],
                                "description": "Frameworks recomendados."
                            }
                        }
                    },
                    "monetization_strategies": {
                        "type": "object",
                        "required": [
                            "payment_methods",
                            "revenue_models"
                        ],
                        "properties": {
                            "revenue_models": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "examples": [
                                    "Suscripciones mensuales (ej: $14.99/mes).",
                                    "Pagos por uso (ej: $1 por servicio).",
                                    "Comisión por transacción (ej: 5% por venta).",
                                    "Publicidad integrada (ej: banners para socios).",
                                    "Venta de datos agregados (anónimos).",
                                    "Donaciones o propinas (ej: via cripto).",
                                    "Modelo freemium (funcionalidades premium).",
                                    "Afiliados (comisión por referidos)."
                                ],
                                "description": "Modelos de ingresos aplicables."
                            },
                            "payment_methods": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": [
                                        "name",
                                        "description",
                                        "integration_level"
                                    ],
                                    "properties": {
                                        "name": {
                                            "type": "string",
                                            "description": "Nombre del método de pago."
                                        },
                                        "description": {
                                            "type": "string",
                                            "description": "Descripción del método."
                                        },
                                        "integration_level": {
                                            "enum": [
                                                "básico",
                                                "avanzado"
                                            ],
                                            "type": "string",
                                            "description": "Nivel de integración (básico/avanzado)."
                                        }
                                    }
                                },
                                "description": "Métodos de pago soportados para monetización."
                            }
                        }
                    }
                },
                "description": "Esquema para un agente especializado en el desarrollo, gestión y monetización de bots de Telegram, con enfoque en automatización, engagement y soluciones low-code para emprendedores y pymes."
            }
        }
    }
]

response = client.beta.conversations.start(
    inputs=inputs,
    model="codestral-latest",
    instructions="""""",
    completion_args=completion_args,
    tools=tools,
)

print(response)