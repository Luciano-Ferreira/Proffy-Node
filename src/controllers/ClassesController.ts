import { Request, Response } from 'express';

import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';

interface ScheduleItem {
    week_day: number,
    from: string,
    to: string
}

export default class ClassesController {

    async index(request: Request, response: Response) {
        const filters = request.query;

        const subject = filters.subject as string;
        const week_day = filters.week_day as string;
        const time = filters.time as string;

        const timeInMinutes = convertHourToMinutes(time);

        if (week_day && subject && timeInMinutes) {
            const classesWithSubjectAndTeacher = await db('classes')
                .whereExists(function () {
                    this.select("class_schedule.*")
                        .from('class_schedule')
                        .whereRaw('`class_schedule`.`class_id`')
                        .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)])
                        .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
                        .whereRaw('`class_schedule`.`to` > ??', [timeInMinutes])
                })
                .where('classes.subject', '=', subject)
                .join('users', 'classes.user_id', '=', 'users.id')
                .select(['classes.*', 'users.*']);


            return response.json(classesWithSubjectAndTeacher);


        }
        const classesWithoutFilters = await db('classes')
            .whereExists(function () {
                this.select("class_schedule.*")
                    .from('class_schedule')
            })
            .join('users', 'classes.user_id', '=', 'users.id')
            .select(['classes.*', 'users.*']);


        return response.json(classesWithoutFilters);
    }

    async create(request: Request, response: Response) {

        const {
            name,
            avatar,
            whatsapp,
            bio,
            subject,
            cost,
            schedule
        } = request.body;

        const trx = await db.transaction();

        try {
            const insertedUsersIds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio,
            });
            //id do usuario que foi inserido
            const user_id = insertedUsersIds[0];

            const insertedClassIds = await trx('classes').insert({
                subject,
                cost,
                user_id
            });

            //id da class que foi inserido
            const class_id = insertedClassIds[0];

            const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertHourToMinutes(scheduleItem.from),
                    to: convertHourToMinutes(scheduleItem.to),

                };
            })

            await trx('class_schedule').insert(classSchedule);

            await trx.commit();

            return response.status(201).send();
        } catch (err) {
            await trx.rollback();
            return response.status(400).json({
                error: 'Unexpected error while creating new class'
            })

        }
    }
}
