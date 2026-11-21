import { app } from './app';
import { prisma } from './config/db';
import { env } from './config/env';

const server = app.listen(env.PORT, () => console.log(`AT System API listening on :${env.PORT}`));
const stop = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
