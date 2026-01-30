bot.on('photo', async (ctx, next) => {
    try {
      if (!ctx.session.pnpLiveAdmin || !ctx.session.pnpLiveAdmin.step) {
        return next();
      }

      if (ctx.session.pnpLiveAdmin.step === 'photo') {
        const lang = getLanguage(ctx);
        const file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const file_path = await ctx.telegram.getFile(file_id);
        const download_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file_path.file_path}`;

        if (ctx.session.pnpLiveAdmin.newModel) {
          ctx.session.pnpLiveAdmin.newModel.profile_image_url = download_url;
          await createNewModel(ctx, lang);
        } else if (ctx.session.pnpLiveAdmin.editingModel) {
          const model = ctx.session.pnpLiveAdmin.editingModel;
          model.profile_image_url = download_url;

          // Save changes
          await ModelService.updateModel(model.id, {
            name: model.name,
            username: model.username,
            bio: model.bio,
            profile_image_url: model.profile_image_url
          });

          ctx.session.pnpLiveAdmin = null;

          const keyboard = [
            [{
              text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
              callback_data: `pnplive_view_model_${model.id}`
            }],
            [{ 
              text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
              callback_data: 'pnplive_view_models'
            }]
          ];

          await ctx.reply(
            lang === 'es' ? `✅ **Modelo Actualizado!**\n\n📛 **${model.name}**\n📝 Cambios guardados exitosamente.` : `✅ **Model Updated!**\n\n📛 **${model.name}**\n📝 Changes saved successfully.`, 
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: keyboard
              }
            }
          );
        }
      } else {
        return next();
      }
    } catch (error) {
      logger.error('Error handling photo upload for PNP Live:', error);
      await ctx.reply('❌ Error uploading photo');
    }
  });