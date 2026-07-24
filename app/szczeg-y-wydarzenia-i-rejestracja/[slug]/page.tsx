import { createDynamicArchiveHandlers } from '@/components/clone/dynamic-archive-handlers';

const handlers = createDynamicArchiveHandlers(
  '/szczeg-y-wydarzenia-i-rejestracja/'
);

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const generateStaticParams = handlers.generateStaticParams;
export const generateMetadata = handlers.generateMetadata;
export default handlers.Page;
