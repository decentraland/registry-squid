import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import * as marshal from "./marshal"
import {LinkedContract} from "./_linkedContract"

@Entity_()
export class ThirdPartyMetadata {
    constructor(props?: Partial<ThirdPartyMetadata>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    name!: string

    @StringColumn_({nullable: false})
    description!: string

    @Column_("jsonb", {transformer: {to: obj => obj == null ? undefined : obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new LinkedContract(undefined, marshal.nonNull(val)))}, nullable: true})
    contracts!: (LinkedContract)[] | undefined | null
}
