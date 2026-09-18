import 'dotenv/config'

import { connectDatabase, disconnectDatabase } from './database.js'
import { loadEnv } from './env.js'
import {
  Batch,
  Category,
  Medicine,
  Supplier,
  User,
} from '../models/index.js'
import { hashPassword } from '../utils/password.js'

async function seed() {
  const env = loadEnv()

  if (env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      'Seeding is blocked in production. Set ALLOW_SEED=true only if you intentionally want to seed.',
    )
  }

  await connectDatabase(env.MONGODB_URI)

  console.log('Clearing existing development seed collections...')
  await Promise.all([
    User.deleteMany({ email: 'admin@pharmastock.local' }),
    Category.deleteMany({
      name: { $in: ['Analgesics', 'Antibiotics', 'Vitamins'] },
    }),
    Supplier.deleteMany({
      name: { $in: ['PharmaTun', 'MediSupply', 'HealthDistrib'] },
    }),
    Medicine.deleteMany({
      barcode: { $in: ['8901001001001', '8901001001002', '8901001001003'] },
    }),
    Batch.deleteMany({
      batchNumber: { $in: ['BATCH-PARA-001', 'BATCH-AMOX-001', 'BATCH-VITC-001'] },
    }),
  ])

  const adminPassword = await hashPassword('Admin123!')

  const admin = await User.create({
    firstName: 'Admin',
    lastName: 'PharmaStock',
    email: 'admin@pharmastock.local',
    password: adminPassword,
    role: 'ADMIN',
    phone: '+21600000000',
    isActive: true,
  })

  const categories = await Category.insertMany([
    {
      name: 'Analgesics',
      description: 'Pain relief medicines',
      isActive: true,
    },
    {
      name: 'Antibiotics',
      description: 'Antibacterial medicines',
      isActive: true,
    },
    {
      name: 'Vitamins',
      description: 'Vitamin supplements',
      isActive: true,
    },
  ])

  const suppliers = await Supplier.insertMany([
    {
      name: 'PharmaTun',
      phone: '+21671111111',
      email: 'contact@pharmatun.local',
      address: 'Tunis, Tunisia',
      contactPerson: 'Sara Ben Ali',
      isActive: true,
    },
    {
      name: 'MediSupply',
      phone: '+21672222222',
      email: 'sales@medisupply.local',
      address: 'Sfax, Tunisia',
      contactPerson: 'Karim Trabelsi',
      isActive: true,
    },
    {
      name: 'HealthDistrib',
      phone: '+21673333333',
      address: 'Sousse, Tunisia',
      contactPerson: 'Amine Gharbi',
      isActive: true,
    },
  ])

  const medicines = await Medicine.insertMany([
    {
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      description: 'Analgesic and antipyretic',
      category: categories[0]!._id,
      laboratory: 'Local Pharma',
      barcode: '8901001001001',
      purchasePrice: 1.2,
      sellingPrice: 2.5,
      minimumStock: 20,
      unit: 'box',
      supplier: suppliers[0]!._id,
      isActive: true,
    },
    {
      name: 'Amoxicillin 500mg',
      genericName: 'Amoxicillin',
      description: 'Broad-spectrum antibiotic',
      category: categories[1]!._id,
      laboratory: 'BioMed',
      barcode: '8901001001002',
      purchasePrice: 4.5,
      sellingPrice: 7.9,
      minimumStock: 10,
      unit: 'box',
      supplier: suppliers[1]!._id,
      isActive: true,
    },
    {
      name: 'Vitamin C 1000mg',
      genericName: 'Ascorbic acid',
      description: 'Vitamin C supplement',
      category: categories[2]!._id,
      laboratory: 'VitaLab',
      barcode: '8901001001003',
      purchasePrice: 3.0,
      sellingPrice: 5.5,
      minimumStock: 15,
      unit: 'bottle',
      supplier: suppliers[2]!._id,
      isActive: true,
    },
  ])

  await Batch.insertMany([
    {
      medicine: medicines[0]!._id,
      batchNumber: 'BATCH-PARA-001',
      quantity: 100,
      purchasePrice: 1.2,
      expirationDate: new Date('2027-06-30'),
      receivedDate: new Date(),
      isActive: true,
    },
    {
      medicine: medicines[1]!._id,
      batchNumber: 'BATCH-AMOX-001',
      quantity: 50,
      purchasePrice: 4.5,
      expirationDate: new Date('2027-01-15'),
      receivedDate: new Date(),
      isActive: true,
    },
    {
      medicine: medicines[2]!._id,
      batchNumber: 'BATCH-VITC-001',
      quantity: 75,
      purchasePrice: 3.0,
      expirationDate: new Date('2028-03-01'),
      receivedDate: new Date(),
      isActive: true,
    },
  ])

  console.log('Seed completed successfully.')
  console.log(`Admin user: ${admin.email} / Admin123! (password is hashed)`)
  console.log(
    `Created ${categories.length} categories, ${suppliers.length} suppliers, ${medicines.length} medicines, 3 batches.`,
  )
}

seed()
  .catch((error: unknown) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
