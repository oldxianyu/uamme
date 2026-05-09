import { Hono } from 'hono';
import { authRoutes } from './auth';
import { webhookRoutes } from './webhook';
import { templateRoutes } from './template';
import { contentSourceRoutes } from './content';
import { customContentRoutes } from './custom';
import { pushRoutes } from './push';
import { dashboardRoutes } from './dashboard';

export const apiRoutes = new Hono();

apiRoutes.route('/auth', authRoutes);
apiRoutes.route('/webhooks', webhookRoutes);
apiRoutes.route('/templates', templateRoutes);
apiRoutes.route('/content-sources', contentSourceRoutes);
apiRoutes.route('/custom-contents', customContentRoutes);
apiRoutes.route('/push', pushRoutes);
apiRoutes.route('/dashboard', dashboardRoutes);
