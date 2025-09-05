const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Perfume Store API',
      version: '1.0.0',
      description: 'API documentation for the Perfume E-commerce Platform',
      contact: {
        name: 'API Support',
        email: 'support@perfumestore.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              default: 'user',
            },
          },
        },
        Perfume: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Midnight Rose',
            },
            brand: {
              type: 'string',
              example: 'Luxury Scents',
            },
            price: {
              type: 'number',
              example: 129.99,
            },
            originalPrice: {
              type: 'number',
              example: 159.99,
            },
            image: {
              type: 'string',
              example: '/placeholder.svg?height=300&width=300&text=Midnight+Rose',
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: [
                '/placeholder.svg?height=600&width=600&text=Midnight+Rose+1',
                '/placeholder.svg?height=600&width=600&text=Midnight+Rose+2',
              ],
            },
            rating: {
              type: 'number',
              example: 4.8,
            },
            reviews: {
              type: 'number',
              example: 124,
            },
            badge: {
              type: 'string',
              example: 'Best Seller',
            },
            category: {
              type: 'string',
              example: 'floral',
            },
            size: {
              type: 'string',
              example: '50ml',
            },
            concentration: {
              type: 'string',
              enum: ['EDT', 'EDP', 'Parfum', 'EDC'],
              example: 'EDP',
            },
            topNotes: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['Rose', 'Bergamot', 'Pink Pepper'],
            },
            middleNotes: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['Jasmine', 'Peony', 'Lily of the Valley'],
            },
            baseNotes: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['Musk', 'Sandalwood', 'Amber'],
            },
            description: {
              type: 'string',
              example: 'A captivating floral fragrance that embodies elegance and femininity...',
            },
            gender: {
              type: 'string',
              enum: ['Men', 'Women', 'Unisex'],
              example: 'Women',
            },
            inStock: {
              type: 'boolean',
              example: true,
            },
            stockCount: {
              type: 'number',
              example: 25,
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Floral',
            },
            description: {
              type: 'string',
              example: 'Romantic and feminine scents',
            },
            image: {
              type: 'string',
              example: '/placeholder.svg?height=300&width=400&text=Floral+Fragrances',
            },
            productCount: {
              type: 'number',
              example: 45,
            },
          },
        },
        CartItem: {
          type: 'object',
          properties: {
            perfume: {
              type: 'string',
              format: 'ObjectId',
              example: '64a1b8e7e4b3d3f3b8e7e4b3',
            },
            quantity: {
              type: 'number',
              example: 1,
            },
            size: {
              type: 'string',
              example: '50ml',
            },
            price: {
              type: 'number',
              example: 129.99,
            },
            name: {
              type: 'string',
              example: 'Midnight Rose',
            },
            image: {
              type: 'string',
              example: '/placeholder.svg?height=300&width=300&text=Midnight+Rose',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Not authorized to access this route',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './models/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};